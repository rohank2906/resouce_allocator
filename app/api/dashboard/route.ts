import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { can } from "@/lib/rbac/permissions";
import { getDashboardMetrics } from "@/lib/services/dashboard";
import type { Role } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(session.user.role as Role, "viewAnalytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const metrics = await getDashboardMetrics();
  return NextResponse.json(metrics);
}
