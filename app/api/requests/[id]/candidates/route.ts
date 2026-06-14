import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { addCandidate } from "@/lib/services/candidates";
import { candidateAddSchema } from "@/lib/services/schemas";
import type { Role } from "@prisma/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = candidateAddSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const candidate = await addCandidate({
      requestId: id,
      employeeId: parsed.data.employeeId,
      side: parsed.data.side,
      note: parsed.data.note,
      actorUserId: session.user.id as string,
      actorRole: session.user.role as Role
    });
    return NextResponse.json(candidate, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add candidate";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
