import { Prisma, RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function auditAction(input: {
  userId?: string;
  requestId?: string;
  action: string;
  previousStatus?: RequestStatus;
  newStatus?: RequestStatus;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      requestId: input.requestId,
      action: input.action,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      metadata: input.metadata as Prisma.InputJsonValue | undefined
    }
  });
}
