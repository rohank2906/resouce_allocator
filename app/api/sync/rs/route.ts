import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";
import { syncFromRsSheet } from "@/lib/services/rs-sync";
import { SheetsConfigError } from "@/lib/google/sheets";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "manageSync")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await syncFromRsSheet(session.user.id as string);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SheetsConfigError) {
      return NextResponse.json({ error: err.message, configError: true }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
