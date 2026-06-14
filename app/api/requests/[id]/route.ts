import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const req = await prisma.resourceRequest.findUnique({
    where: { id },
    include: {
      requestingProject: { select: { id: true, name: true } },
      sourceProject: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      candidates: {
        orderBy: { createdAt: "asc" },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              position: true,
              project: { select: { id: true, name: true } }
            }
          },
          proposer: { select: { id: true, name: true, email: true } }
        }
      },
      approvals: {
        include: {
          employee: { select: { id: true, name: true, email: true, position: true } },
          decidedBy: { select: { name: true, email: true } }
        }
      }
    }
  });

  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(req);
}
