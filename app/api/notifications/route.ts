import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const where: Record<string, unknown> = { userId: session.user.id };
  if (unreadOnly) where.readAt = null;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { request: { select: { id: true, title: true } } }
    }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } })
  ]);

  if (unreadOnly) return NextResponse.json({ count: unreadCount });
  return NextResponse.json({ notifications, unreadCount });
}

export async function PUT() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() }
  });

  return NextResponse.json({ success: true });
}
