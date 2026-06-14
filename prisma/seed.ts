import { PrismaClient, Role, Position } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

const CSV_PATH = join(process.cwd(), "Final Allocations - Sheet1.csv");
const DEFAULT_PASSWORD_HASH = hashSync("password123", 10);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch === "\r") {
        // skip
      } else {
        cell += ch;
      }
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function mapStatusToPosition(status: string): Position {
  const s = status.trim().toLowerCase();
  if (s === "project lead") return Position.PL;
  if (s === "quality lead") return Position.QUALITY_LEAD;
  if (s === "fte-tasker") return Position.TASKER;
  if (s === "intern-tasker") return Position.INTERN_TASKER;
  if (s === "engineering") return Position.ENGINEERING_SUPPORT;
  if (s === "research") return Position.RESEARCH_SUPPORT;
  if (s === "tpm") return Position.TPM;
  return Position.TASKER;
}

function positionToRole(position: Position): Role {
  switch (position) {
    case Position.PL:
      return Role.PL;
    case Position.QUALITY_LEAD:
      return Role.QUALITY_LEAD;
    case Position.TPM:
      return Role.TPM;
    default:
      return Role.EMPLOYEE;
  }
}

function normalizeEmail(raw: string): string {
  let email = raw.trim().toLowerCase();
  // Fix CSV typo: comma-in-domain (e.g. "akash.sharma@ethara,ai")
  const atIdx = email.indexOf("@");
  if (atIdx >= 0) {
    const local = email.slice(0, atIdx);
    const domain = email.slice(atIdx + 1).replace(/,/g, ".");
    email = `${local}@${domain}`;
  }
  return email;
}

async function main() {
  console.log("→ Wiping existing data...");
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.requestApproval.deleteMany();
  await prisma.resourceRequest.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("→ Creating admin accounts...");
  await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@company.com",
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: Role.ADMIN
    }
  });
  await prisma.user.create({
    data: {
      name: "Rohan Khatri",
      email: "rohan.khatri@ethara.ai",
      passwordHash: hashSync("rohan@123", 10),
      role: Role.ADMIN
    }
  });

  console.log(`→ Reading CSV: ${CSV_PATH}`);
  const raw = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(raw);

  const [header, ...dataRows] = rows;
  console.log(`→ CSV header: ${header.join(" | ")}`);
  console.log(`→ Rows: ${dataRows.length}`);

  // Pass 1: collect unique projects.
  const projectNames = new Set<string>();
  for (const r of dataRows) {
    const projectName = (r[2] || "").trim();
    if (!projectName) continue;
    projectNames.add(projectName);
  }

  console.log(`→ Unique projects: ${projectNames.size}`);
  const projectMap = new Map<string, string>(); // name → id
  for (const name of projectNames) {
    const project = await prisma.project.create({
      data: { name, description: null }
    });
    projectMap.set(name, project.id);
  }

  // Pass 2: create users + employees.
  let createdEmployees = 0;
  let createdUsers = 0;
  let skipped = 0;
  const seenEmails = new Set<string>();

  for (const r of dataRows) {
    const name = (r[0] || "").trim();
    const emailRaw = (r[1] || "").trim();
    const projectName = (r[2] || "").trim();
    const status = (r[3] || "").trim();

    if (!name || !emailRaw || !projectName) {
      skipped++;
      continue;
    }

    const email = normalizeEmail(emailRaw);
    if (seenEmails.has(email)) {
      skipped++;
      continue;
    }
    seenEmails.add(email);

    const projectId = projectMap.get(projectName);
    if (!projectId) {
      skipped++;
      continue;
    }

    const position = mapStatusToPosition(status);
    const role = positionToRole(position);

    const user = await prisma.user.create({
      data: { name, email, passwordHash: DEFAULT_PASSWORD_HASH, role }
    });
    createdUsers++;

    await prisma.employee.create({
      data: { name, email, position, projectId, userId: user.id }
    });
    createdEmployees++;
  }

  const counts = {
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    employees: await prisma.employee.count()
  };

  console.log("");
  console.log("✓ Seed complete");
  console.log(`  Users:     ${counts.users} (created ${createdUsers} from CSV + 1 admin)`);
  console.log(`  Projects:  ${counts.projects}`);
  console.log(`  Employees: ${counts.employees} (skipped ${skipped})`);
  console.log("");
  console.log("Login: any seeded email + password123");
  console.log("Admin: admin@company.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
