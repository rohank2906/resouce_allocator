import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import { Position } from "@prisma/client";
import type { Role } from "@prisma/client";

const POSITION_VALUES = Object.values(Position) as [Position, ...Position[]];

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  projectId: z.string().min(1).optional(),
  position: z.enum(POSITION_VALUES).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageEmployees")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.projectId && parsed.data.projectId !== existing.projectId) {
    const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: parsed.data,
    include: { project: { select: { id: true, name: true } } }
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id as string,
      action: "EMPLOYEE_UPDATED",
      metadata: { employeeId: id, changes: parsed.data }
    }
  });

  return NextResponse.json(employee);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageEmployees")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.employee.findUnique({ where: { id }, select: { id: true, email: true, userId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.employee.delete({ where: { id } });
    if (existing.userId) {
      await tx.user.delete({ where: { id: existing.userId } }).catch(() => undefined);
    }
    await tx.auditLog.create({
      data: {
        userId: session.user.id as string,
        action: "EMPLOYEE_REMOVED",
        metadata: { employeeId: id, email: existing.email }
      }
    });
  });

  return NextResponse.json({ ok: true });
}
