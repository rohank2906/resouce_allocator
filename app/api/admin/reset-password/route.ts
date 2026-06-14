import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { hash } from "bcryptjs";
import { Position } from "@prisma/client";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import { defaultPasswordFor } from "@/lib/auth/passwords";
import type { Role } from "@prisma/client";

const RESETTABLE_POSITIONS = new Set<Position>([Position.TPM, Position.PL]);

const schema = z.object({
  userId: z.string().min(1)
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (!can(role, "resetOtherPassword")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: {
      id: true,
      email: true,
      role: true,
      employee: { select: { position: true } }
    }
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.role === "ADMIN") {
    return NextResponse.json(
      { error: "Cannot reset an admin account password." },
      { status: 403 }
    );
  }

  const position = target.employee?.position;
  if (!position || !RESETTABLE_POSITIONS.has(position)) {
    return NextResponse.json(
      { error: "Only TPM and Project Lead accounts can be reset to default." },
      { status: 403 }
    );
  }

  const newPassword = defaultPasswordFor(target.email);
  const passwordHash = await hash(newPassword, 10);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordResetAt: now
      }
    }),
    prisma.session.deleteMany({ where: { userId: target.id } })
  ]);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id as string,
      action: "USER_PASSWORD_RESET",
      metadata: {
        targetUserId: target.id,
        targetEmail: target.email,
        position
      }
    }
  });

  return NextResponse.json({
    ok: true,
    email: target.email,
    temporaryPassword: newPassword
  });
}
