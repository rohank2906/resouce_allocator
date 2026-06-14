import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";

const PROJECT_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      employees: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          position: true,
          attendanceStatus: true,
          attendanceDate: true,
          lastSyncedAt: true,
          user: { select: { id: true, email: true } }
        }
      },
      incomingRequests: {
        where: { status: { in: ["PENDING", "APPROVED", "PARTIALLY_APPROVED"] } },
        include: {
          requestingProject: { select: { name: true } },
          _count: { select: { approvals: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 20
      },
      outgoingRequests: {
        include: {
          sourceProject: { select: { name: true } },
          _count: { select: { approvals: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(project);
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  type: z.string().trim().max(60).optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
  description: z.string().trim().max(500).optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageProjects")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const dupe = await prisma.project.findUnique({ where: { name: parsed.data.name } });
    if (dupe) return NextResponse.json({ error: "Project name already exists" }, { status: 409 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status) {
    data.active = parsed.data.status !== "ARCHIVED";
  }

  const project = await prisma.project.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id as string,
      action: parsed.data.status === "ARCHIVED" ? "PROJECT_ARCHIVED" : "PROJECT_UPDATED",
      metadata: { projectId: id, changes: parsed.data }
    }
  });

  return NextResponse.json(project);
}

const OPEN_REQUEST_STATUSES = ["PENDING", "APPROVED", "PARTIALLY_APPROVED"] as const;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageProjects")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const transferToProjectId = url.searchParams.get("transferTo") || undefined;
  const offboardEmployees = url.searchParams.get("offboard") === "true";

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          employees: true,
          incomingRequests: { where: { status: { in: ["PENDING", "APPROVED", "PARTIALLY_APPROVED"] } } },
          outgoingRequests: { where: { status: { in: ["PENDING", "APPROVED", "PARTIALLY_APPROVED"] } } }
        }
      }
    }
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const openRequests = project._count.incomingRequests + project._count.outgoingRequests;
  if (openRequests > 0) {
    return NextResponse.json(
      {
        error: "Project has open requests. Complete or reject them before deletion.",
        openRequests
      },
      { status: 409 }
    );
  }

  const employeeCount = project._count.employees;

  if (employeeCount > 0 && !transferToProjectId && !offboardEmployees) {
    return NextResponse.json(
      {
        error: "Project has employees. Provide ?transferTo=<projectId> to reassign, or ?offboard=true to remove.",
        employeeCount
      },
      { status: 409 }
    );
  }

  if (employeeCount > 0 && transferToProjectId) {
    if (transferToProjectId === id) {
      return NextResponse.json(
        { error: "Transfer destination must differ from the project being deleted." },
        { status: 400 }
      );
    }
    const target = await prisma.project.findUnique({ where: { id: transferToProjectId } });
    if (!target) {
      return NextResponse.json({ error: "Transfer destination not found" }, { status: 400 });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (employeeCount > 0) {
        const employees = await tx.employee.findMany({
          where: { projectId: id },
          select: { id: true, userId: true }
        });

        if (transferToProjectId) {
          await tx.employee.updateMany({
            where: { projectId: id },
            data: { projectId: transferToProjectId }
          });
        } else if (offboardEmployees) {
          const userIds = employees.map((e) => e.userId).filter((v): v is string => Boolean(v));
          await tx.employee.deleteMany({ where: { projectId: id } });
          if (userIds.length > 0) {
            await tx.user.deleteMany({ where: { id: { in: userIds }, role: { in: ["EMPLOYEE", "SUB_ADMIN", "QUALITY_LEAD"] } } });
          }
        }
      }

      await tx.project.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: session.user.id as string,
          action: "PROJECT_DELETED",
          metadata: {
            projectId: id,
            projectName: project.name,
            employeesAffected: employeeCount,
            mode: employeeCount > 0
              ? (transferToProjectId ? "transferred" : "offboarded")
              : "empty",
            transferToProjectId: transferToProjectId ?? null
          }
        }
      });
    });

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
