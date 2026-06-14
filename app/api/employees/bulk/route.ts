import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";

const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    ids: z.array(z.string()).min(1).max(1000),
    projectId: z.string().min(1)
  }),
  z.object({
    action: z.literal("offboard"),
    ids: z.array(z.string()).min(1).max(1000)
  })
]);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageEmployees")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bulkSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { ids, action } = parsed.data;

  if (action === "move") {
    const target = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { id: true, name: true }
    });
    if (!target) {
      return NextResponse.json({ error: "Destination project not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const employees = await tx.employee.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true, projectId: true, project: { select: { name: true } } }
      });

      const moves = employees.filter((e) => e.projectId !== target.id);
      if (moves.length === 0) {
        return { updated: 0, employees };
      }

      await tx.employee.updateMany({
        where: { id: { in: moves.map((e) => e.id) } },
        data: { projectId: target.id }
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id as string,
          action: "EMPLOYEES_BULK_MOVED",
          metadata: {
            count: moves.length,
            targetProjectId: target.id,
            targetProjectName: target.name,
            employeeIds: moves.map((e) => e.id)
          }
        }
      });

      return { updated: moves.length, employees };
    });

    return NextResponse.json({ ok: true, updated: result.updated });
  }

  const result = await prisma.$transaction(async (tx) => {
    const employees = await tx.employee.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, userId: true, projectId: true, position: true }
    });

    const userIds = employees.map((e) => e.userId).filter((v): v is string => Boolean(v));

    await tx.employee.deleteMany({ where: { id: { in: ids } } });

    if (userIds.length > 0) {
      await tx.user.deleteMany({
        where: {
          id: { in: userIds },
          role: { in: ["EMPLOYEE", "SUB_ADMIN", "QUALITY_LEAD"] }
        }
      });
    }

    await tx.auditLog.create({
      data: {
        userId: session.user.id as string,
        action: "EMPLOYEES_BULK_OFFBOARDED",
        metadata: {
          count: employees.length,
          employees: employees.map((e) => ({
            id: e.id,
            email: e.email,
            name: e.name,
            position: e.position,
            projectId: e.projectId
          }))
        }
      }
    });

    return { removed: employees.length };
  });

  return NextResponse.json({ ok: true, removed: result.removed });
}
