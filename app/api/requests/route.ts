import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import { requestCreateSchema } from "@/lib/services/schemas";
import { createResourceRequest } from "@/lib/services/requests";
import type { Role } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "viewOwnAssignment")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const projectId = searchParams.get("projectId");
  const priority = searchParams.get("priority");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;

  // For PL, show requests related to their project
  if (role === "PL") {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    if (employee) {
      where.OR = [
        { sourceProjectId: employee.projectId },
        { requestingProjectId: employee.projectId }
      ];
    }
  }

  if (projectId) {
    delete where.OR;
    where.OR = [{ sourceProjectId: projectId }, { requestingProjectId: projectId }];
  }

  const requests = await prisma.resourceRequest.findMany({
    where: where as any,
    include: {
      requestingProject: { select: { id: true, name: true } },
      sourceProject: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      approvals: { include: { employee: { select: { id: true, name: true, email: true, position: true } } } }
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
  });

  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(session.user.role as Role, "createRequests")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = requestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createResourceRequest(parsed.data, session.user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
