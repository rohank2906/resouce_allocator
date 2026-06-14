import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { decideCandidate, removeCandidate } from "@/lib/services/candidates";
import { candidateDecideSchema } from "@/lib/services/schemas";
import type { Role } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cid } = await params;
  const json = await request.json().catch(() => null);
  const parsed = candidateDecideSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await decideCandidate({
      candidateId: cid,
      side: parsed.data.side,
      decision: parsed.data.decision,
      note: parsed.data.note,
      actorUserId: session.user.id as string,
      actorRole: session.user.role as Role
    });
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to decide candidate";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cid } = await params;
  try {
    await removeCandidate({
      candidateId: cid,
      actorUserId: session.user.id as string,
      actorRole: session.user.role as Role
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove candidate";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
