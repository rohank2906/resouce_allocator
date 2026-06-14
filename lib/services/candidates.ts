import {
  CandidateDecision,
  CandidateProposer,
  NotificationEvent,
  Position,
  RequestStatus,
  Role
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { auditAction } from "@/lib/services/audit";
import {
  adminAndTpmUserIds,
  notifyUsers,
  projectLeadUserIds
} from "@/lib/services/notifications";

export type CandidateSide = "REQUESTER" | "SOURCE";

const TASKER_POSITIONS: Position[] = [Position.TASKER, Position.INTERN_TASKER];
const ALLOWED_POSITIONS: Position[] = [
  Position.PL,
  Position.QUALITY_LEAD,
  Position.TASKER,
  Position.INTERN_TASKER
];

async function resolveActorSide(opts: {
  userId: string;
  role: Role;
  requestingProjectId: string;
  sourceProjectId: string;
}): Promise<{ canRequester: boolean; canSource: boolean; isAdmin: boolean }> {
  const isAdmin = opts.role === Role.ADMIN;
  if (isAdmin) return { canRequester: true, canSource: true, isAdmin: true };

  const emp = await prisma.employee.findUnique({
    where: { userId: opts.userId },
    select: { projectId: true, position: true }
  });

  const isPL = opts.role === Role.PL;
  const canRequester = isPL && emp?.projectId === opts.requestingProjectId;
  const canSource = isPL && emp?.projectId === opts.sourceProjectId;
  return { canRequester, canSource, isAdmin: false };
}

export async function addCandidate(input: {
  requestId: string;
  employeeId: string;
  side: CandidateSide;
  note?: string;
  actorUserId: string;
  actorRole: Role;
}) {
  const request = await prisma.resourceRequest.findUniqueOrThrow({
    where: { id: input.requestId },
    select: {
      id: true,
      status: true,
      requestingProjectId: true,
      sourceProjectId: true,
      requestingProject: { select: { name: true } },
      sourceProject: { select: { name: true } }
    }
  });

  if (request.status === RequestStatus.COMPLETED || request.status === RequestStatus.REJECTED) {
    throw new Error("Request is closed and no longer accepting candidates");
  }

  const perms = await resolveActorSide({
    userId: input.actorUserId,
    role: input.actorRole,
    requestingProjectId: request.requestingProjectId,
    sourceProjectId: request.sourceProjectId
  });

  if (input.side === "REQUESTER" && !perms.canRequester) {
    throw new Error("Only the requesting project's PL or admin can propose from the requester side");
  }
  if (input.side === "SOURCE" && !perms.canSource) {
    throw new Error("Only the source project's PL or admin can propose from the source side");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, projectId: true, position: true, name: true }
  });
  if (!employee) throw new Error("Employee not found");
  if (employee.projectId !== request.sourceProjectId) {
    throw new Error("Employee must currently belong to the source project");
  }
  if (!ALLOWED_POSITIONS.includes(employee.position)) {
    throw new Error("Only PL, Quality Lead, or Tasker (FTE/Intern) employees can be candidates");
  }

  const proposedBy = input.side === "REQUESTER" ? CandidateProposer.REQUESTER : CandidateProposer.SOURCE;
  const requesterDecision =
    proposedBy === CandidateProposer.REQUESTER ? CandidateDecision.ACCEPTED : CandidateDecision.PENDING;
  const sourceDecision =
    proposedBy === CandidateProposer.SOURCE ? CandidateDecision.ACCEPTED : CandidateDecision.PENDING;

  const candidate = await prisma.requestCandidate.create({
    data: {
      requestId: request.id,
      employeeId: employee.id,
      proposedBy,
      proposedById: input.actorUserId,
      requesterDecision,
      sourceDecision,
      note: input.note
    },
    include: {
      employee: { select: { id: true, name: true, email: true, position: true } }
    }
  });

  await auditAction({
    userId: input.actorUserId,
    requestId: request.id,
    action: "CANDIDATE_PROPOSED",
    metadata: {
      candidateId: candidate.id,
      employeeId: employee.id,
      employeeName: employee.name,
      proposedBy
    }
  });

  // Notify the OTHER side's PLs so they can review
  const otherSideProjectId =
    proposedBy === CandidateProposer.REQUESTER ? request.sourceProjectId : request.requestingProjectId;
  const recipients = await projectLeadUserIds(otherSideProjectId);
  await notifyUsers({
    userIds: recipients,
    requestId: request.id,
    event: NotificationEvent.REQUEST_CREATED,
    title: `New candidate on request: ${employee.name}`,
    body: `${proposedBy === CandidateProposer.REQUESTER ? request.requestingProject.name : request.sourceProject.name} proposed ${employee.name}. Awaiting your review.`
  });

  await maybeCompleteRequest(request.id, input.actorUserId);
  return candidate;
}

export async function decideCandidate(input: {
  candidateId: string;
  side: CandidateSide;
  decision: "ACCEPTED" | "REJECTED";
  note?: string;
  actorUserId: string;
  actorRole: Role;
}) {
  const candidate = await prisma.requestCandidate.findUniqueOrThrow({
    where: { id: input.candidateId },
    include: {
      request: {
        select: {
          id: true,
          status: true,
          requestingProjectId: true,
          sourceProjectId: true,
          requestingProject: { select: { name: true } },
          sourceProject: { select: { name: true } }
        }
      },
      employee: { select: { id: true, name: true, position: true } }
    }
  });

  if (candidate.request.status === RequestStatus.COMPLETED || candidate.request.status === RequestStatus.REJECTED) {
    throw new Error("Request is closed");
  }

  const perms = await resolveActorSide({
    userId: input.actorUserId,
    role: input.actorRole,
    requestingProjectId: candidate.request.requestingProjectId,
    sourceProjectId: candidate.request.sourceProjectId
  });
  if (input.side === "REQUESTER" && !perms.canRequester) {
    throw new Error("Only the requesting project's PL or admin can decide on the requester side");
  }
  if (input.side === "SOURCE" && !perms.canSource) {
    throw new Error("Only the source project's PL or admin can decide on the source side");
  }

  const decisionValue =
    input.decision === "ACCEPTED" ? CandidateDecision.ACCEPTED : CandidateDecision.REJECTED;
  const updateData =
    input.side === "REQUESTER"
      ? { requesterDecision: decisionValue, note: input.note }
      : { sourceDecision: decisionValue, note: input.note };

  const updated = await prisma.requestCandidate.update({
    where: { id: candidate.id },
    data: updateData,
    include: { employee: { select: { id: true, name: true, email: true, position: true } } }
  });

  await auditAction({
    userId: input.actorUserId,
    requestId: candidate.request.id,
    action: `CANDIDATE_${input.side}_${input.decision}`,
    metadata: { candidateId: candidate.id, employeeId: candidate.employee.id, employeeName: candidate.employee.name }
  });

  // Notify the OTHER side
  const otherSideProjectId =
    input.side === "REQUESTER" ? candidate.request.sourceProjectId : candidate.request.requestingProjectId;
  const recipients = await projectLeadUserIds(otherSideProjectId);
  await notifyUsers({
    userIds: recipients,
    requestId: candidate.request.id,
    event:
      input.decision === "ACCEPTED"
        ? NotificationEvent.REQUEST_APPROVED
        : NotificationEvent.REQUEST_REJECTED,
    title: `${candidate.employee.name}: ${input.side === "REQUESTER" ? "requester" : "source"} ${input.decision.toLowerCase()}`,
    body: `${candidate.employee.name} on request — ${input.side.toLowerCase()} side ${input.decision.toLowerCase()}.`
  });

  await maybeCompleteRequest(candidate.request.id, input.actorUserId);
  return updated;
}

export async function removeCandidate(input: {
  candidateId: string;
  actorUserId: string;
  actorRole: Role;
}) {
  const candidate = await prisma.requestCandidate.findUniqueOrThrow({
    where: { id: input.candidateId },
    include: {
      request: { select: { id: true, status: true, requestingProjectId: true, sourceProjectId: true } }
    }
  });

  if (candidate.request.status === RequestStatus.COMPLETED || candidate.request.status === RequestStatus.REJECTED) {
    throw new Error("Request is closed");
  }

  const isAdmin = input.actorRole === Role.ADMIN;
  if (!isAdmin && candidate.proposedById !== input.actorUserId) {
    throw new Error("Only the proposer or admin can remove this candidate");
  }

  await prisma.requestCandidate.delete({ where: { id: candidate.id } });
  await auditAction({
    userId: input.actorUserId,
    requestId: candidate.request.id,
    action: "CANDIDATE_REMOVED",
    metadata: { candidateId: candidate.id }
  });
}

export async function rejectRequest(input: {
  requestId: string;
  actorUserId: string;
  actorRole: Role;
  note?: string;
}) {
  const request = await prisma.resourceRequest.findUniqueOrThrow({
    where: { id: input.requestId },
    select: {
      id: true,
      status: true,
      requestingProjectId: true,
      sourceProjectId: true,
      createdById: true,
      title: true
    }
  });

  if (request.status === RequestStatus.COMPLETED || request.status === RequestStatus.REJECTED) {
    throw new Error("Request is already closed");
  }

  const perms = await resolveActorSide({
    userId: input.actorUserId,
    role: input.actorRole,
    requestingProjectId: request.requestingProjectId,
    sourceProjectId: request.sourceProjectId
  });
  if (!perms.canSource && !perms.isAdmin) {
    throw new Error("Only the source PL or admin can reject the whole request");
  }

  await prisma.resourceRequest.update({
    where: { id: request.id },
    data: { status: RequestStatus.REJECTED }
  });

  await auditAction({
    userId: input.actorUserId,
    requestId: request.id,
    action: "REQUEST_REJECTED",
    previousStatus: request.status,
    newStatus: RequestStatus.REJECTED,
    metadata: { note: input.note }
  });

  await notifyUsers({
    userIds: [request.createdById, ...(await adminAndTpmUserIds())],
    requestId: request.id,
    event: NotificationEvent.REQUEST_REJECTED,
    title: `Request rejected: ${request.title}`,
    body: input.note ?? "Source side rejected the request."
  });
}

export async function adminForceComplete(input: {
  requestId: string;
  actorUserId: string;
  actorRole: Role;
}) {
  if (input.actorRole !== Role.ADMIN) {
    throw new Error("Only admin can force-complete a request");
  }
  return executeCompletion(input.requestId, input.actorUserId, { force: true });
}

async function maybeCompleteRequest(requestId: string, actorUserId: string) {
  const request = await prisma.resourceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      plNeeded: true,
      qualityLeadsNeeded: true,
      taskersNeeded: true
    }
  });
  if (!request) return;
  if (request.status === RequestStatus.COMPLETED || request.status === RequestStatus.REJECTED) return;

  const finalizedByPosition = await getFinalizedCounts(requestId);

  const meetsPL = finalizedByPosition.PL >= request.plNeeded;
  const meetsQL = finalizedByPosition.QUALITY_LEAD >= request.qualityLeadsNeeded;
  const meetsTasker =
    finalizedByPosition.TASKER + finalizedByPosition.INTERN_TASKER >= request.taskersNeeded;

  if (!(meetsPL && meetsQL && meetsTasker)) {
    if (finalizedByPosition.PL + finalizedByPosition.QUALITY_LEAD + finalizedByPosition.TASKER + finalizedByPosition.INTERN_TASKER > 0
        && request.status !== RequestStatus.PARTIALLY_APPROVED) {
      await prisma.resourceRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.PARTIALLY_APPROVED }
      });
    }
    return;
  }

  await executeCompletion(requestId, actorUserId, { force: false });
}

async function getFinalizedCounts(requestId: string): Promise<Record<Position, number>> {
  const finalized = await prisma.requestCandidate.findMany({
    where: {
      requestId,
      requesterDecision: CandidateDecision.ACCEPTED,
      sourceDecision: CandidateDecision.ACCEPTED
    },
    include: { employee: { select: { position: true } } }
  });
  const counts: Record<string, number> = {
    PL: 0, QUALITY_LEAD: 0, TASKER: 0, INTERN_TASKER: 0,
    TPM: 0, ENGINEERING_SUPPORT: 0, RESEARCH_SUPPORT: 0
  };
  for (const c of finalized) counts[c.employee.position]++;
  return counts as Record<Position, number>;
}

async function executeCompletion(requestId: string, actorUserId: string, opts: { force: boolean }) {
  const request = await prisma.resourceRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      title: true,
      createdById: true,
      requestingProjectId: true,
      sourceProjectId: true,
      requestingProject: { select: { name: true } },
      sourceProject: { select: { name: true } }
    }
  });

  const finalizedCandidates = await prisma.requestCandidate.findMany({
    where: {
      requestId,
      requesterDecision: CandidateDecision.ACCEPTED,
      sourceDecision: CandidateDecision.ACCEPTED
    },
    include: { employee: { select: { id: true, name: true, position: true, projectId: true } } }
  });

  if (finalizedCandidates.length === 0) {
    throw new Error("No finalized candidates to transfer");
  }

  const employeeIds = finalizedCandidates.map((c) => c.employee.id);
  const moves = finalizedCandidates.map((c) => ({
    employeeId: c.employee.id,
    employeeName: c.employee.name,
    from: c.employee.projectId,
    to: request.requestingProjectId
  }));

  await prisma.$transaction(async (tx) => {
    await tx.employee.updateMany({
      where: { id: { in: employeeIds } },
      data: { projectId: request.requestingProjectId }
    });
    await tx.resourceRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.COMPLETED }
    });
  });

  await auditAction({
    userId: actorUserId,
    requestId,
    action: opts.force ? "REQUEST_ADMIN_FORCE_COMPLETED" : "TRANSFER_COMPLETED",
    previousStatus: request.status,
    newStatus: RequestStatus.COMPLETED,
    metadata: { transferred: finalizedCandidates.length, moves }
  });

  await notifyUsers({
    userIds: [
      request.createdById,
      ...(await projectLeadUserIds(request.sourceProjectId)),
      ...(await projectLeadUserIds(request.requestingProjectId)),
      ...(await adminAndTpmUserIds())
    ],
    requestId,
    event: NotificationEvent.TRANSFER_COMPLETED,
    title: `Transfer completed: ${request.title}`,
    body: `${finalizedCandidates.length} employee${finalizedCandidates.length === 1 ? "" : "s"} moved to ${request.requestingProject.name}.`
  });
}

export const __internal = { maybeCompleteRequest, executeCompletion, getFinalizedCounts, TASKER_POSITIONS };
