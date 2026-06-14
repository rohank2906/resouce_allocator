import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import { RequestStatus } from "@prisma/client";
import { decideResourceRequest } from "@/lib/services/requests";
import type { Role } from "@prisma/client";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(session.user.role as Role, "decideRequests")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { requestIds, decision, note } = body;

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return NextResponse.json({ error: "requestIds must be a non-empty array" }, { status: 400 });
  }

  if (![RequestStatus.APPROVED, RequestStatus.REJECTED].includes(decision)) {
    return NextResponse.json({ error: "Bulk decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  const results: { id: string; status: string }[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const requestId of requestIds) {
    try {
      const result = await decideResourceRequest(
        requestId,
        { decision, employeeIds: decision === RequestStatus.REJECTED ? [] : [], note },
        session.user.id
      );
      results.push({ id: requestId, status: result.status });
    } catch (error) {
      errors.push({ id: requestId, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return NextResponse.json({ results, errors });
}
