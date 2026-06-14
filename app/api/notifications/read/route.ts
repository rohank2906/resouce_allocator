import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { notificationId } = body;

  if (notificationId) {
    await prisma.notification.update({
      where: { id: notificationId, userId: session.user.id },
      data: { readAt: new Date() }
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() }
    });
  }

  return NextResponse.json({ success: true });
}
