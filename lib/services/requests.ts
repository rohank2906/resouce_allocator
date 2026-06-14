import {
  CandidateDecision,
  CandidateProposer,
  NotificationEvent,
  Position,
  RequestStatus
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { auditAction } from "@/lib/services/audit";
import { adminAndTpmUserIds, notifyUsers, projectLeadUserIds } from "@/lib/services/notifications";
import type { RequestCreateInput, RequestDecisionInput } from "@/lib/services/schemas";

const ALLOWED_CANDIDATE_POSITIONS: Position[] = [
  Position.PL,
  Position.QUALITY_LEAD,
  Position.TASKER,
  Position.INTERN_TASKER
];

export async function createResourceRequest(input: RequestCreateInput, userId: string) {
  const wishlistIds = (input.requestedEmployeeIds ?? []).filter((id) => id.length > 0);

  // Validate wishlist BEFORE creating the request so we don't leave orphans.
  let wishlist: { id: string; position: Position; projectId: string; name: string }[] = [];
  if (wishlistIds.length > 0) {
    wishlist = await prisma.employee.findMany({
      where: { id: { in: wishlistIds } },
      select: { id: true, position: true, projectId: true, name: true }
    });
    if (wishlist.length !== wishlistIds.length) {
      throw new Error("One or more requested employees not found");
    }
    for (const emp of wishlist) {
      if (emp.projectId !== input.sourceProjectId) {
        throw new Error(`${emp.name} is not currently on the source project`);
      }
      if (!ALLOWED_CANDIDATE_POSITIONS.includes(emp.position)) {
        throw new Error(`${emp.name} has an unsupported position for candidacy`);
      }
    }
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.resourceRequest.create({
      data: {
        title: input.title,
        requestingProjectId: input.requestingProjectId,
        sourceProjectId: input.sourceProjectId,
        plNeeded: input.plNeeded,
        taskersNeeded: input.taskersNeeded,
        qualityLeadsNeeded: input.qualityLeadsNeeded,
        priority: input.priority,
        justification: input.justification,
        requiredBy: input.requiredBy,
        createdById: userId
      },
      include: { requestingProject: true, sourceProject: true }
    });

    if (wishlist.length > 0) {
      await tx.requestCandidate.createMany({
        data: wishlist.map((emp) => ({
          requestId: created.id,
          employeeId: emp.id,
          proposedBy: CandidateProposer.REQUESTER,
          proposedById: userId,
          requesterDecision: CandidateDecision.ACCEPTED,
          sourceDecision: CandidateDecision.PENDING
        }))
      });
    }

    return created;
  });

  await auditAction({
    userId,
    requestId: request.id,
    action: "REQUEST_CREATED",
    newStatus: RequestStatus.PENDING,
    metadata: { wishlistCount: wishlist.length, wishlistIds: wishlist.map((e) => e.id) }
  });

  await notifyUsers({
    userIds: [...(await projectLeadUserIds(input.sourceProjectId)), ...(await adminAndTpmUserIds())],
    requestId: request.id,
    event: NotificationEvent.REQUEST_CREATED,
    title: `New request from ${request.requestingProject.name}`,
    body: wishlist.length > 0
      ? `${request.title} — ${wishlist.length} specific employee${wishlist.length === 1 ? "" : "s"} named.`
      : request.title
  });

  return request;
}

export async function decideResourceRequest(requestId: string, input: RequestDecisionInput, userId: string) {
  const request = await prisma.resourceRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { sourceProject: true, requestingProject: true }
  });

  if (input.decision !== RequestStatus.REJECTED && input.employeeIds.length === 0) {
    throw new Error("Approvals require explicitly selected employees");
  }

  const selected = await prisma.employee.findMany({
    where: { id: { in: input.employeeIds }, projectId: request.sourceProjectId },
    select: { id: true, position: true, projectId: true }
  });

  if (selected.length !== input.employeeIds.length) {
    throw new Error("All selected employees must belong to the source project");
  }

  const taskers = selected.filter((e) => e.position === Position.TASKER || e.position === Position.INTERN_TASKER).length;
  const qualityLeads = selected.filter((e) => e.position === Position.QUALITY_LEAD).length;
  const pls = selected.filter((e) => e.position === Position.PL).length;
  if (taskers > request.taskersNeeded || qualityLeads > request.qualityLeadsNeeded || pls > request.plNeeded) {
    throw new Error("Selected employees exceed requested staffing counts");
  }

  const fullyMet =
    pls === request.plNeeded &&
    qualityLeads === request.qualityLeadsNeeded &&
    taskers === request.taskersNeeded;

  const newStatus =
    input.decision === RequestStatus.REJECTED
      ? RequestStatus.REJECTED
      : fullyMet
        ? RequestStatus.APPROVED
        : RequestStatus.PARTIALLY_APPROVED;

  await prisma.$transaction(async (tx) => {
    await tx.requestApproval.deleteMany({ where: { requestId } });
    if (newStatus !== RequestStatus.REJECTED) {
      await tx.requestApproval.createMany({
        data: selected.map((employee) => ({
          requestId,
          employeeId: employee.id,
          decidedById: userId,
          decision: newStatus,
          note: input.note
        }))
      });
      await tx.employee.updateMany({
        where: { id: { in: selected.map((employee) => employee.id) } },
        data: { projectId: request.requestingProjectId }
      });
    }
    await tx.resourceRequest.update({
      where: { id: requestId },
      data: { status: newStatus === RequestStatus.REJECTED ? newStatus : RequestStatus.COMPLETED }
    });
  });

  const finalStatus = newStatus === RequestStatus.REJECTED ? newStatus : RequestStatus.COMPLETED;
  await auditAction({
    userId,
    requestId,
    action: newStatus === RequestStatus.REJECTED ? "REQUEST_REJECTED" : "TRANSFER_COMPLETED",
    previousStatus: request.status,
    newStatus: finalStatus,
    metadata: { selectedEmployeeIds: input.employeeIds, decision: newStatus, note: input.note }
  });

  await notifyUsers({
    userIds: [request.createdById, ...(await adminAndTpmUserIds())],
    requestId,
    event: newStatus === RequestStatus.REJECTED ? NotificationEvent.REQUEST_REJECTED : NotificationEvent.TRANSFER_COMPLETED,
    title: `${request.title} ${finalStatus.toLowerCase().replace("_", " ")}`,
    body: `${selected.length} employees selected by ${request.sourceProject.name}`
  });

  return prisma.resourceRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { approvals: { include: { employee: true } } }
  });
}
