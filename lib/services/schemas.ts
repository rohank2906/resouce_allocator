import { Priority, RequestStatus, CandidateDecision } from "@prisma/client";
import { z } from "zod";

export const requestCreateSchema = z.object({
  title: z.string().min(3),
  requestingProjectId: z.string().min(1),
  sourceProjectId: z.string().min(1),
  plNeeded: z.coerce.number().int().min(0).default(0),
  taskersNeeded: z.coerce.number().int().min(0).default(0),
  qualityLeadsNeeded: z.coerce.number().int().min(0).default(0),
  priority: z.nativeEnum(Priority),
  justification: z.string().min(10),
  requiredBy: z.coerce.date(),
  requestedEmployeeIds: z.array(z.string().min(1)).optional().default([])
}).refine((data) => data.plNeeded + data.taskersNeeded + data.qualityLeadsNeeded > 0, {
  message: "Request at least one resource",
  path: ["taskersNeeded"]
}).refine((data) => data.requestingProjectId !== data.sourceProjectId, {
  message: "Source and requesting projects must differ",
  path: ["sourceProjectId"]
});

export const requestDecisionSchema = z.object({
  decision: z.enum([RequestStatus.APPROVED, RequestStatus.PARTIALLY_APPROVED, RequestStatus.REJECTED]),
  employeeIds: z.array(z.string()).default([]),
  note: z.string().optional()
});

export const candidateAddSchema = z.object({
  employeeId: z.string().min(1),
  side: z.enum(["REQUESTER", "SOURCE"]),
  note: z.string().optional()
});

export const candidateDecideSchema = z.object({
  side: z.enum(["REQUESTER", "SOURCE"]),
  decision: z.enum([CandidateDecision.ACCEPTED, CandidateDecision.REJECTED]),
  note: z.string().optional()
});

export const requestRejectSchema = z.object({
  note: z.string().optional()
});

export type RequestCreateInput = z.infer<typeof requestCreateSchema>;
export type RequestDecisionInput = z.infer<typeof requestDecisionSchema>;
export type CandidateAddInput = z.infer<typeof candidateAddSchema>;
export type CandidateDecideInput = z.infer<typeof candidateDecideSchema>;
