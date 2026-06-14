import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";
import { syncEmployeesFromGoogleSheet } from "@/lib/services/sheets-sync";
import { SheetsConfigError } from "@/lib/google/sheets";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "viewSyncHistory")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const history = await prisma.syncHistory.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      startedBy: { select: { id: true, name: true, email: true } }
    }
  });

  const hasCreds = Boolean(
    process.env.GOOGLE_SHEETS_API_KEY ||
      (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
  );

  const [employeesLastSuccess, rsLastSuccess] = await Promise.all([
    prisma.syncHistory.findFirst({
      where: { source: "GOOGLE_SHEET", status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { completedAt: "desc" }
    }),
    prisma.syncHistory.findFirst({
      where: { source: "RS_SHEET", status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { completedAt: "desc" }
    })
  ]);

  const sources = [
    {
      key: "GOOGLE_SHEET" as const,
      label: "Employees",
      description: "Workforce roster — creates users, sets position and project.",
      sheetId: process.env.GOOGLE_SHEET_ID ?? null,
      range: process.env.GOOGLE_SHEET_RANGE ?? "Sheet1!A:D",
      endpoint: "/api/sync",
      isConfigured: hasCreds && Boolean(process.env.GOOGLE_SHEET_ID),
      lastSuccess: employeesLastSuccess
    },
    {
      key: "RS_SHEET" as const,
      label: "Resource Segregation",
      description: "Daily attendance + current project assignment.",
      sheetId: process.env.GOOGLE_RS_SHEET_ID ?? null,
      range: process.env.GOOGLE_RS_SHEET_RANGE ?? "Resource Segregation!A:N",
      endpoint: "/api/sync/rs",
      isConfigured: hasCreds && Boolean(process.env.GOOGLE_RS_SHEET_ID),
      lastSuccess: rsLastSuccess
    }
  ];

  return NextResponse.json({
    history,
    sources,
    isConfigured: sources.every((s) => s.isConfigured),
    sheetId: process.env.GOOGLE_SHEET_ID ?? null,
    lastSuccess: employeesLastSuccess
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageSync")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await syncEmployeesFromGoogleSheet(session.user.id as string);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SheetsConfigError) {
      return NextResponse.json({ error: err.message, configError: true }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
