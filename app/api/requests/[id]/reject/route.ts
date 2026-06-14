import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { rejectRequest } from "@/lib/services/candidates";
import { requestRejectSchema } from "@/lib/services/schemas";
import type { Role } from "@prisma/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = requestRejectSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await rejectRequest({
      requestId: id,
      actorUserId: session.user.id as string,
      actorRole: session.user.role as Role,
      note: parsed.data.note
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reject request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
