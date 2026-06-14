import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { defaultPasswordFor } from "@/lib/auth/passwords";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
  confirmPassword: z.string().min(1)
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let validCurrent = false;
  if (user.passwordHash) {
    validCurrent = await compare(currentPassword, user.passwordHash);
  } else {
    validCurrent = currentPassword === defaultPasswordFor(user.email);
  }

  if (!validCurrent) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      passwordResetAt: null
    }
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "PASSWORD_CHANGED",
      metadata: { email: user.email }
    }
  });

  return NextResponse.json({ ok: true });
}
