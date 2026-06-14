import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { adminForceComplete } from "@/lib/services/candidates";
import type { Role } from "@prisma/client";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await adminForceComplete({
      requestId: id,
      actorUserId: session.user.id as string,
      actorRole: session.user.role as Role
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to force-complete request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
