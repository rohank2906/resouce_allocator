import { Position, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { auditAction } from "@/lib/services/audit";
import { readEmployeeRows } from "@/lib/google/sheets";
import { defaultPasswordFor } from "@/lib/auth/passwords";

const positionMap: Record<string, Position> = {
  tpm: Position.TPM,
  pl: Position.PL,
  "project lead": Position.PL,
  "quality lead": Position.QUALITY_LEAD,
  ql: Position.QUALITY_LEAD,
  tasker: Position.TASKER,
  "fte tasker": Position.TASKER,
  "fte-tasker": Position.TASKER,
  intern: Position.INTERN_TASKER,
  "intern tasker": Position.INTERN_TASKER,
  "intern-tasker": Position.INTERN_TASKER,
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

const ETHARA_EMAIL = /^[a-z0-9._-]+@ethara\.ai$/i;

export type SheetEmployeeRow = {
  name: string;
  email: string;
  project: string;
  position: string;
};

export interface SyncResult {
  imported: number;
  updated: number;
  duplicates: number;
  skipped: number;
  errors: Array<{ row: number; email?: string; reason: string }>;
  syncId: string;
  durationMs: number;
}

export async function syncEmployeesFromRows(
  rows: SheetEmployeeRow[],
  actorId?: string,
  source: string = "GOOGLE_SHEET"
): Promise<SyncResult> {
  const startedAt = new Date();
  const history = await prisma.syncHistory.create({
    data: {
      source,
      status: "RUNNING",
      startedById: actorId,
      startedAt
    }
  });

  const seen = new Set<string>();
  const errors: SyncResult["errors"] = [];
  let imported = 0;
  let updated = 0;
  let duplicates = 0;
  let skipped = 0;

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const email = row.email.toLowerCase().trim();

      if (!email) {
        skipped++;
        continue;
      }

      if (!ETHARA_EMAIL.test(email)) {
        errors.push({ row: rowNum, email, reason: "Email must end with @ethara.ai" });
        continue;
      }

      if (seen.has(email)) {
        duplicates++;
        continue;
      }
      seen.add(email);

      const position = positionMap[row.position.toLowerCase().trim()];
      if (!position) {
        errors.push({
          row: rowNum,
          email,
          reason: `Unknown position: "${row.position}"`
        });
        continue;
      }

      const projectName = row.project.trim();
      if (!projectName) {
        errors.push({ row: rowNum, email, reason: "Project name empty" });
        continue;
      }
      const name = row.name.trim() || email.split("@")[0];

      try {
        const project = await prisma.project.upsert({
          where: { name: projectName },
          update: { active: true },
          create: { name: projectName, active: true, status: "ACTIVE" }
        });

        const grantsLogin = position === Position.PL || position === Position.TPM;
        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, passwordHash: true }
        });

        let userId: string;
        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { name, role: roleForPosition(position) }
          });
          userId = existingUser.id;
        } else {
          const passwordHash = grantsLogin
            ? await hash(defaultPasswordFor(email), 10)
            : null;
          const created = await prisma.user.create({
            data: {
              email,
              name,
              role: roleForPosition(position),
              passwordHash,
              mustChangePassword: grantsLogin,
              isActive: true
            }
          });
          userId = created.id;
        }
        const user = { id: userId };

        const existing = await prisma.employee.findUnique({ where: { email } });
        await prisma.employee.upsert({
          where: { email },
          update: { name, position, projectId: project.id, userId: user.id },
          create: { name, email, position, projectId: project.id, userId: user.id }
        });

        if (existing) updated++;
        else imported++;
      } catch (err) {
        errors.push({
          row: rowNum,
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
        imported,
        updated,
        duplicates,
        errors: errors.length > 0 ? errors : undefined,
        completedAt,
        durationMs,
        message: `${imported} imported, ${updated} updated, ${duplicates} duplicates, ${errors.length} errors`
      }
    });

    await auditAction({
      userId: actorId,
      action: "EMPLOYEE_SHEET_SYNC",
      metadata: { imported, updated, duplicates, errors: errors.length, durationMs }
    });

    return {
      imported,
      updated,
      duplicates,
      skipped,
      errors,
      syncId: history.id,
      durationMs
    };
  } catch (err) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const message = err instanceof Error ? err.message : "Sync failed";

    await prisma.syncHistory.update({
      where: { id: history.id },
      data: {
        status: "FAILED",
        completedAt,
        durationMs,
        message
      }
    });

    await auditAction({
      userId: actorId,
      action: "EMPLOYEE_SHEET_SYNC_FAILED",
      metadata: { message, durationMs }
    });

    throw err;
  }
}

export async function syncEmployeesFromGoogleSheet(actorId?: string): Promise<SyncResult> {
  const rows = await readEmployeeRows();
  return syncEmployeesFromRows(rows, actorId, "GOOGLE_SHEET");
}
