import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import { hash } from "bcryptjs";
import type { Prisma, Role } from "@prisma/client";
import { Position } from "@prisma/client";

const POSITION_VALUES = Object.values(Position) as [Position, ...Position[]];
const ETHARA_EMAIL = /^[a-z0-9._-]+@ethara\.ai$/i;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "viewAllProjects") && !can(role, "viewOwnAssignment")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const position = searchParams.get("position");
  const search = searchParams.get("search");

  const where: Prisma.EmployeeWhereInput = {};
  if (projectId) where.projectId = projectId;
  if (position) where.position = position as Prisma.EmployeeWhereInput["position"];
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } }
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      position: true,
      attendanceStatus: true,
      attendanceDate: true,
      lastSyncedAt: true,
      source: true,
      project: { select: { id: true, name: true } }
    },
    orderBy: { name: "asc" }
  });

  return NextResponse.json(employees);
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().regex(ETHARA_EMAIL, "Email must end with @ethara.ai"),
  projectId: z.string().min(1),
  position: z.enum(POSITION_VALUES)
});

function firstName(email: string): string {
  return (email.split("@")[0] ?? "").split(".")[0]?.toLowerCase() ?? "";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageEmployees")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, projectId, position } = parsed.data;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const dupeEmployee = await prisma.employee.findUnique({ where: { email } });
  if (dupeEmployee) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const dupeUser = await prisma.user.findUnique({ where: { email } });
  if (dupeUser) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const defaultPassword = `${firstName(email)}@123`;
  const passwordHash = await hash(defaultPassword, 10);

  const userRole: Role = position === Position.TPM || position === Position.PL
    ? ("SUB_ADMIN" as Role)
    : ("EMPLOYEE" as Role);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash, role: userRole }
    });
    const employee = await tx.employee.create({
      data: { name, email, position, projectId, userId: user.id },
      include: { project: { select: { id: true, name: true } } }
    });
    await tx.auditLog.create({
      data: {
        userId: session.user.id as string,
        action: "EMPLOYEE_CREATED",
        metadata: { employeeId: employee.id, email, position, projectId, projectName: project.name }
      }
    });
    return employee;
  });

  return NextResponse.json(result, { status: 201 });
}

const patchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  projectId: z.string().min(1)
});

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageEmployees")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { ids, projectId } = parsed.data;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Target project not found" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const employees = await tx.employee.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, projectId: true, project: { select: { name: true } } }
    });

    if (employees.length === 0) {
      return { updated: 0, moves: [] as Array<{ employeeId: string; from: string; to: string }> };
    }

    const moves = employees
      .filter((e) => e.projectId !== projectId)
      .map((e) => ({ employeeId: e.id, from: e.project.name, to: project.name }));

    await tx.employee.updateMany({
      where: { id: { in: employees.map((e) => e.id) } },
      data: { projectId }
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id as string,
        action: "EMPLOYEE_REASSIGNED",
        metadata: {
          targetProjectId: projectId,
          targetProjectName: project.name,
          count: employees.length,
          employeeIds: employees.map((e) => e.id),
          moves
        }
      }
    });

    return { updated: employees.length, moves };
  });

  return NextResponse.json(result);
}
