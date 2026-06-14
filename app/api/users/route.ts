import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/rbac/permissions";
import { hashSync } from "bcryptjs";
import type { Role } from "@prisma/client";
import { derivePasswordStatus } from "@/lib/services/password-status";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role as Role, "manageUsers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: true,
      passwordResetAt: true,
      lastLogin: true,
      createdAt: true,
      employee: {
        select: {
          position: true,
          project: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const decorated = users.map((u) => ({
    ...u,
    passwordStatus: derivePasswordStatus({
      mustChangePassword: u.mustChangePassword,
      passwordChangedAt: u.passwordChangedAt,
      passwordResetAt: u.passwordResetAt,
      lastLogin: u.lastLogin
    })
  }));

  return NextResponse.json(decorated);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role as Role, "manageUsers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, role, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: hashSync(password, 10), role: role || "EMPLOYEE" }
  });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role }, { status: 201 });
}
