import { AttendanceStatus, Position, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { auditAction } from "@/lib/services/audit";
import { readRsRows, type RsSheetRow } from "@/lib/google/sheets";
import { defaultPasswordFor } from "@/lib/auth/passwords";

const ETHARA_EMAIL = /^[a-z0-9._-]+@ethara\.ai$/i;
const RS_SOURCE = "rs_sheet";

const attendanceMap: Record<string, AttendanceStatus> = {
  present: AttendanceStatus.PRESENT,
  p: AttendanceStatus.PRESENT,
  leave: AttendanceStatus.LEAVE,
  "on leave": AttendanceStatus.LEAVE,
  l: AttendanceStatus.LEAVE,
  absent: AttendanceStatus.ABSENT,
  a: AttendanceStatus.ABSENT
};

const jobTitleToPosition: Record<string, Position> = {
  tpm: Position.TPM,
  pl: Position.PL,
  "project lead": Position.PL,
  "quality lead": Position.QUALITY_LEAD,
  ql: Position.QUALITY_LEAD,
  tasker: Position.TASKER,
  "fte tasker": Position.TASKER,
  intern: Position.INTERN_TASKER,
  "intern tasker": Position.INTERN_TASKER,
  engineering: Position.ENGINEERING_SUPPORT,
  "engineering support": Position.ENGINEERING_SUPPORT,
  research: Position.RESEARCH_SUPPORT,
  "research support": Position.RESEARCH_SUPPORT
};

function roleForPosition(position: Position): Role {
  if (position === Position.PL || position === Position.TPM) return Role.SUB_ADMIN;
  if (position === Position.QUALITY_LEAD) return Role.QUALITY_LEAD;
  return Role.EMPLOYEE;
}

function parseAttendance(raw: string): AttendanceStatus | null {
  if (!raw) return null;
  const norm = raw.toLowerCase().trim();
  return attendanceMap[norm] ?? AttendanceStatus.UNKNOWN;
}

function parseRsDate(raw: string): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, mm, dd, yyRaw] = m;
  const yy = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
  const d = new Date(Date.UTC(yy, Number(mm) - 1, Number(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface RsSyncResult {
  attendanceUpdated: number;
  projectMoved: number;
  created: number;
  unchanged: number;
  skipped: number;
  duplicates: number;
  errors: Array<{ row: number; email?: string; reason: string }>;
  newProjects: string[];
  syncId: string;
  durationMs: number;
}

interface ProjectLookup {
  byNormalizedName: Map<string, { id: string; name: string }>;
  byStartsWith: Map<string, { id: string; name: string }>;
}

const PROJECT_TOKEN_SPLIT = /[-\s(]/;

async function buildProjectLookup(): Promise<ProjectLookup> {
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const byNormalizedName = new Map<string, { id: string; name: string }>();
  const byStartsWith = new Map<string, { id: string; name: string }>();
  for (const p of projects) {
    const lower = p.name.toLowerCase().trim();
    byNormalizedName.set(lower, p);
    const firstWord = lower.split(PROJECT_TOKEN_SPLIT)[0];
    if (firstWord && !byStartsWith.has(firstWord)) byStartsWith.set(firstWord, p);
  }
  return { byNormalizedName, byStartsWith };
}

function resolveProject(
  rsName: string,
  lookup: ProjectLookup
): { id: string; name: string } | null {
  const lower = rsName.toLowerCase().trim();
  if (!lower) return null;
  const direct = lookup.byNormalizedName.get(lower);
  if (direct) return direct;
  const firstWord = lower.split(PROJECT_TOKEN_SPLIT)[0];
  if (firstWord) {
    const byPrefix = lookup.byStartsWith.get(firstWord);
    if (byPrefix) return byPrefix;
  }
  return null;
}

export async function syncFromRsRows(
  rows: RsSheetRow[],
  actorId?: string
): Promise<RsSyncResult> {
  const startedAt = new Date();
  const history = await prisma.syncHistory.create({
    data: { source: "RS_SHEET", status: "RUNNING", startedById: actorId, startedAt }
  });

  const seen = new Set<string>();
  const errors: RsSyncResult["errors"] = [];
  const newProjects: string[] = [];
  let attendanceUpdated = 0;
  let projectMoved = 0;
  let created = 0;
  let unchanged = 0;
  let skipped = 0;
  let duplicates = 0;

  try {
    let lookup = await buildProjectLookup();
    const syncTimestamp = new Date();

    for (const row of rows) {
      const email = row.email;
      if (!email) {
        skipped++;
        continue;
      }
      if (!ETHARA_EMAIL.test(email)) {
        errors.push({ row: row.rowNumber, email, reason: "Email must end with @ethara.ai" });
        continue;
      }
      if (seen.has(email)) {
        duplicates++;
        continue;
      }
      seen.add(email);

      const attendance = parseAttendance(row.attendance);
      const attendanceDate = parseRsDate(row.date);

      try {
        const existing = await prisma.employee.findUnique({
          where: { email },
          select: { id: true, projectId: true, attendanceStatus: true }
        });

        let targetProject: { id: string; name: string } | null = null;
        if (row.currentProject) {
          targetProject = resolveProject(row.currentProject, lookup);
          if (!targetProject) {
            const fresh = await prisma.project.create({
              data: { name: row.currentProject, active: true, status: "ACTIVE" }
            });
            targetProject = { id: fresh.id, name: fresh.name };
            newProjects.push(fresh.name);
            lookup = await buildProjectLookup();
          }
        }

        if (existing) {
          const projectChanged =
            targetProject !== null && targetProject.id !== existing.projectId;
          const attendanceChanged = attendance !== existing.attendanceStatus;
          const update: {
            attendanceStatus?: AttendanceStatus | null;
            attendanceDate?: Date | null;
            lastSyncedAt: Date;
            source: string;
            projectId?: string;
          } = {
            lastSyncedAt: syncTimestamp,
            source: RS_SOURCE
          };
          if (attendance !== null) update.attendanceStatus = attendance;
          if (attendanceDate) update.attendanceDate = attendanceDate;
          if (projectChanged && targetProject) update.projectId = targetProject.id;
          await prisma.employee.update({ where: { id: existing.id }, data: update });

          if (attendanceChanged) attendanceUpdated++;
          if (projectChanged) projectMoved++;
          if (!attendanceChanged && !projectChanged) unchanged++;
        } else {
          if (!targetProject) {
            errors.push({
              row: row.rowNumber,
              email,
              reason: `Employee not in DB and no resolvable project for "${row.currentProject || "<empty>"}"`
            });
            continue;
          }
          const jobTitleLower = row.jobTitle.toLowerCase().trim();
          const position = jobTitleToPosition[jobTitleLower] ?? Position.TASKER;
          const grantsLogin = position === Position.PL || position === Position.TPM;
          const name = row.name || email.split("@")[0];

          await prisma.$transaction(async (tx) => {
            const passwordHash = grantsLogin
              ? await hash(defaultPasswordFor(email), 10)
              : null;
            const user = await tx.user.create({
              data: {
                email,
                name,
                role: roleForPosition(position),
                passwordHash,
                mustChangePassword: grantsLogin,
                isActive: true
              }
            });
            await tx.employee.create({
              data: {
                email,
                name,
                position,
                projectId: targetProject!.id,
                userId: user.id,
                attendanceStatus: attendance,
                attendanceDate: attendanceDate ?? undefined,
                lastSyncedAt: syncTimestamp,
                source: RS_SOURCE
              }
            });
          });
          created++;
        }
      } catch (err) {
        errors.push({
          row: row.rowNumber,
          email,
          reason: err instanceof Error ? err.message : "Unknown DB error"
        });
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const status = errors.length === 0 ? "SUCCESS" : "PARTIAL";

    await prisma.syncHistory.update({
      where: { id: history.id },
      data: {
        status,
        imported: created,
        updated: attendanceUpdated + projectMoved + unchanged,
        duplicates,
        errors: errors.length > 0 ? errors : undefined,
        completedAt,
        durationMs,
        message: `${created} created · ${attendanceUpdated} attendance · ${projectMoved} moved · ${unchanged} unchanged · ${errors.length} errors`
      }
    });

    await auditAction({
      userId: actorId,
      action: "RS_SHEET_SYNC",
      metadata: {
        created,
        attendanceUpdated,
        projectMoved,
        unchanged,
        duplicates,
        newProjects,
        errors: errors.length,
        durationMs
      }
    });

    return {
      attendanceUpdated,
      projectMoved,
      created,
      unchanged,
      skipped,
      duplicates,
      errors,
      newProjects,
      syncId: history.id,
      durationMs
    };
  } catch (err) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const message = err instanceof Error ? err.message : "Sync failed";

    await prisma.syncHistory.update({
      where: { id: history.id },
      data: { status: "FAILED", completedAt, durationMs, message }
    });
    await auditAction({
      userId: actorId,
      action: "RS_SHEET_SYNC_FAILED",
      metadata: { message, durationMs }
    });

    throw err;
  }
}

export async function syncFromRsSheet(actorId?: string): Promise<RsSyncResult> {
  const rows = await readRsRows();
  return syncFromRsRows(rows, actorId);
}
