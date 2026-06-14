import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import type { Position, Role } from "@prisma/client";

const PROJECT_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [projects, breakdown] = await Promise.all([
    prisma.project.findMany({
      where: { active: true },
      include: {
        _count: { select: { employees: true, incomingRequests: true, outgoingRequests: true } }
      },
      orderBy: { name: "asc" }
    }),
    prisma.employee.groupBy({
      by: ["projectId", "position"],
      _count: { _all: true }
    })
  ]);

  const breakdownByProject = new Map<string, Record<Position, number>>();
  for (const row of breakdown) {
    const current = breakdownByProject.get(row.projectId) ?? ({} as Record<Position, number>);
    current[row.position] = row._count._all;
    breakdownByProject.set(row.projectId, current);
  }

  const projectsWithBreakdown = projects.map((p) => ({
    ...p,
    positions: breakdownByProject.get(p.id) ?? {}
  }));

  return NextResponse.json(projectsWithBreakdown);
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.string().trim().max(60).optional().nullable(),
  status: z.enum(PROJECT_STATUSES).default("ACTIVE"),
  description: z.string().trim().max(500).optional().nullable()
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageProjects")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { name, type, status, description } = parsed.data;

  const existing = await prisma.project.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Project name already exists" }, { status: 409 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      type: type ?? null,
      status,
      description: description ?? null,
      active: status !== "ARCHIVED"
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id as string,
      action: "PROJECT_CREATED",
      metadata: { projectId: project.id, name: project.name, type: project.type, status: project.status }
    }
  });

  return NextResponse.json(project, { status: 201 });
}

const putSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().optional()
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageProjects")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const project = await prisma.project.update({ where: { id }, data });
  return NextResponse.json(project);
}
