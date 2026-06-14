import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(session.user.role as Role, "viewAudit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const search = searchParams.get("search");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const offset = Number(searchParams.get("offset") ?? 0);

  const where: Record<string, unknown> = {};
  if (action) where.action = action;

  const logs = await prisma.auditLog.findMany({
    where: where as any,
    include: {
      user: { select: { id: true, name: true, email: true } },
      request: { select: { id: true, title: true } }
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  const filtered = search
    ? logs.filter((log) =>
        [log.action, log.user?.name, log.user?.email, log.request?.title]
          .some((field) => field?.toLowerCase().includes(search.toLowerCase()))
      )
    : logs;

  const total = await prisma.auditLog.count({ where: where as any });

  return NextResponse.json({ logs: filtered, total, limit, offset });
}
