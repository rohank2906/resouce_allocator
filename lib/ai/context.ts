import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const TOP_PROJECTS = 25;
const RECENT_REQUESTS = 8;
const ENTITY_LOOKUP_LIMIT = 12;

interface CallerContext {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  employeeId: string | null;
  projectId: string | null;
  projectName: string | null;
}

interface ProjectSummary {
  name: string;
  total: number;
  present: number;
  leave: number;
  absent: number;
  unsynced: number;
  positions: Record<string, number>;
}

interface PersonHit {
  name: string;
  email: string;
  position: string;
  project: string;
  attendanceStatus: string | null;
  attendanceDate: string | null;
}

export async function buildCallerContext(
  userId: string,
  email: string,
  name: string | null,
  role: Role
): Promise<CallerContext> {
  const employee = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true, projectId: true, project: { select: { name: true } } }
  });
  return {
    userId,
    email,
    name,
    role,
    employeeId: employee?.id ?? null,
    projectId: employee?.projectId ?? null,
    projectName: employee?.project?.name ?? null
  };
}

function isGlobalView(role: Role): boolean {
  return role === "ADMIN" || role === "SUB_ADMIN" || role === "TPM";
}

const NAME_TOKEN = /[a-z][a-z._-]+(?:@ethara\.ai)?/gi;

function extractTokens(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of text.toLowerCase().matchAll(NAME_TOKEN)) {
    const tok = match[0];
    if (tok.length < 3) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

const STOPWORDS = new Set([
  "show", "list", "tell", "give", "find", "search", "who", "what", "when",
  "where", "which", "how", "why", "the", "and", "for", "are", "any", "all",
  "from", "into", "with", "this", "that", "they", "them", "their", "have",
  "has", "been", "but", "not", "yes", "now", "today", "tomorrow", "yesterday",
  "many", "much", "people", "employee", "employees", "users", "tasker",
  "taskers", "project", "projects", "team", "teams", "members", "member",
  "present", "leave", "absent", "attendance", "current", "lead", "leads",
  "manager", "managers", "request", "requests"
]);

async function resolvePeople(tokens: string[], projectIdFilter: string | null): Promise<PersonHit[]> {
  if (tokens.length === 0) return [];
  const candidates = tokens.filter((t) => !STOPWORDS.has(t) && t.length >= 3);
  if (candidates.length === 0) return [];

  const hits = await prisma.employee.findMany({
    where: {
      ...(projectIdFilter ? { projectId: projectIdFilter } : {}),
      OR: candidates.flatMap((t) => [
        { email: { contains: t } },
        { name: { contains: t } }
      ])
    },
    take: ENTITY_LOOKUP_LIMIT,
    select: {
      name: true,
      email: true,
      position: true,
      attendanceStatus: true,
      attendanceDate: true,
      project: { select: { name: true } }
    }
  });

  return hits.map((h) => ({
    name: h.name,
    email: h.email,
    position: h.position,
    project: h.project?.name ?? "—",
    attendanceStatus: h.attendanceStatus,
    attendanceDate: h.attendanceDate ? h.attendanceDate.toISOString().slice(0, 10) : null
  }));
}

async function projectSummary(projectId: string | null): Promise<ProjectSummary[]> {
  const where = projectId ? { id: projectId } : {};
  const projects = await prisma.project.findMany({
    where,
    select: {
      name: true,
      employees: {
        select: { position: true, attendanceStatus: true }
      }
    }
  });

  const list: ProjectSummary[] = projects.map((p) => {
    const summary: ProjectSummary = {
      name: p.name,
      total: p.employees.length,
      present: 0,
      leave: 0,
      absent: 0,
      unsynced: 0,
      positions: {}
    };
    for (const e of p.employees) {
      switch (e.attendanceStatus) {
        case "PRESENT": summary.present++; break;
        case "LEAVE": summary.leave++; break;
        case "ABSENT": summary.absent++; break;
        case null: summary.unsynced++; break;
      }
      summary.positions[e.position] = (summary.positions[e.position] ?? 0) + 1;
    }
    return summary;
  });

  list.sort((a, b) => b.total - a.total);
  return list.slice(0, TOP_PROJECTS);
}

export async function buildAssistantContext(
  caller: CallerContext,
  question: string
): Promise<{ system: string; data: string }> {
  const global = isGlobalView(caller.role);
  const projectScope = global ? null : caller.projectId;

  const [totalEmployees, attendanceGroups, positionGroups, projects, lastRsSync, recentRequests, resolved] =
    await Promise.all([
      prisma.employee.count(projectScope ? { where: { projectId: projectScope } } : undefined),
      prisma.employee.groupBy({
        by: ["attendanceStatus"],
        ...(projectScope ? { where: { projectId: projectScope } } : {}),
        _count: true
      }),
      prisma.employee.groupBy({
        by: ["position"],
        ...(projectScope ? { where: { projectId: projectScope } } : {}),
        _count: true
      }),
      projectSummary(projectScope),
      prisma.syncHistory.findFirst({
        where: { source: "RS_SHEET", status: { in: ["SUCCESS", "PARTIAL"] } },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, message: true }
      }),
      prisma.resourceRequest.findMany({
        take: RECENT_REQUESTS,
        orderBy: { createdAt: "desc" },
        where: global
          ? undefined
          : projectScope
            ? { OR: [{ sourceProjectId: projectScope }, { requestingProjectId: projectScope }] }
            : { createdById: caller.userId },
        select: {
          title: true,
          status: true,
          priority: true,
          plNeeded: true,
          qualityLeadsNeeded: true,
          taskersNeeded: true,
          createdAt: true,
          requiredBy: true,
          requestingProject: { select: { name: true } },
          sourceProject: { select: { name: true } }
        }
      }),
      resolvePeople(extractTokens(question), projectScope)
    ]);

  const attendanceCounts = {
    present: 0,
    leave: 0,
    absent: 0,
    unknown: 0,
    unsynced: 0
  };
  for (const row of attendanceGroups) {
    if (row.attendanceStatus === null) attendanceCounts.unsynced = row._count;
    else if (row.attendanceStatus === "PRESENT") attendanceCounts.present = row._count;
    else if (row.attendanceStatus === "LEAVE") attendanceCounts.leave = row._count;
    else if (row.attendanceStatus === "ABSENT") attendanceCounts.absent = row._count;
    else attendanceCounts.unknown = row._count;
  }

  const system = `You are Ethara Assistant, the in-house AI for the Resource Allocator platform.

GROUND RULES
- You have READ-ONLY access via a structured context block below.
- Answer ONLY from the context. If something is missing, say "I don't have that data in context" — do not invent records.
- Be concise. Prefer short tables or bullet lists for any answer with >2 facts.
- Counts are authoritative — never invent or estimate.
- When the user asks about a named person, project, or role, prefer entries in the RESOLVED matches section if present.

CURRENT USER
- Name: ${caller.name ?? "Unknown"}
- Email: ${caller.email}
- Role: ${caller.role}
- Scope: ${global ? "global (sees all projects)" : caller.projectName ? `project "${caller.projectName}"` : "own record only"}
- Today (server): ${new Date().toISOString().slice(0, 10)}`;

  const lines: string[] = [];
  lines.push("WORKFORCE TOTALS");
  lines.push(`- Total employees${projectScope ? " (in your project)" : ""}: ${totalEmployees}`);
  lines.push(
    `- Attendance today: ${attendanceCounts.present} present · ${attendanceCounts.leave} on leave · ${attendanceCounts.absent} absent · ${attendanceCounts.unsynced} not synced · ${attendanceCounts.unknown} unknown`
  );

  if (lastRsSync?.completedAt) {
    lines.push(`- Last RS sync: ${lastRsSync.completedAt.toISOString()} (${lastRsSync.message ?? ""})`);
  } else {
    lines.push("- Last RS sync: never");
  }
  lines.push("");

  lines.push("POSITIONS");
  if (positionGroups.length === 0) {
    lines.push("- (none)");
  } else {
    for (const p of positionGroups.sort((a, b) => b._count - a._count)) {
      lines.push(`- ${p.position}: ${p._count}`);
    }
  }
  lines.push("");

  lines.push(`PROJECTS (top ${TOP_PROJECTS} by headcount)`);
  if (projects.length === 0) {
    lines.push("- (none)");
  } else {
    for (const p of projects) {
      const positions = Object.entries(p.positions)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}:${v}`)
        .join(", ");
      lines.push(
        `- ${p.name} — ${p.total} total · ${p.present} present · ${p.leave} leave · ${p.absent} absent · ${p.unsynced} not synced · {${positions}}`
      );
    }
  }
  lines.push("");

  lines.push("RECENT REQUESTS");
  if (recentRequests.length === 0) {
    lines.push("- (none)");
  } else {
    for (const r of recentRequests) {
      lines.push(
        `- "${r.title}" — ${r.status}/${r.priority}, ${r.requestingProject.name} ← ${r.sourceProject.name}, need PL:${r.plNeeded} QL:${r.qualityLeadsNeeded} Tasker:${r.taskersNeeded}, due ${r.requiredBy.toISOString().slice(0, 10)}`
      );
    }
  }
  lines.push("");

  if (resolved.length > 0) {
    lines.push("RESOLVED matches for entities mentioned in the question");
    for (const p of resolved) {
      lines.push(
        `- ${p.name} <${p.email}> — ${p.position}, project "${p.project}", attendance ${p.attendanceStatus ?? "(not synced)"}${p.attendanceDate ? ` on ${p.attendanceDate}` : ""}`
      );
    }
  }

  return { system, data: lines.join("\n") };
}
