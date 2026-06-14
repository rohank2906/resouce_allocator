import { NotificationEvent, Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function notifyUsers(input: {
  userIds: string[];
  requestId?: string;
  event: NotificationEvent;
  title: string;
  body: string;
}) {
  const uniqueUserIds = [...new Set(input.userIds)].filter(Boolean);
  if (uniqueUserIds.length === 0) return;

  await prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      requestId: input.requestId,
      event: input.event,
      title: input.title,
      body: input.body
    }))
  });
}

export async function projectLeadUserIds(projectId: string) {
  const leads = await prisma.employee.findMany({
    where: { projectId, position: "PL", userId: { not: null } },
    select: { userId: true }
  });
  return leads.map((lead) => lead.userId).filter((id): id is string => Boolean(id));
}

export async function adminAndTpmUserIds() {
  const users = await prisma.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.TPM] } },
    select: { id: true }
  });
  return users.map((user) => user.id);
}
