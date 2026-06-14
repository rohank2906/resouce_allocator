# Resource Allocator

Internal workforce allocation and resource transfer management platform.

## Stack

- **Frontend**: Next.js 15, TypeScript, TailwindCSS, shadcn/ui, TanStack Table, React Query, Recharts
- **Backend**: Next.js API Routes, Prisma ORM
- **Auth**: NextAuth with credentials (extensible to email providers)
- **Database**: SQLite (dev) / PostgreSQL (production)
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure at minimum:

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite: `file:./dev.db`, PostgreSQL: `postgresql://...` |
| `NEXTAUTH_SECRET` | Random secret for session encryption |
| `NEXTAUTH_URL` | Application URL (e.g., `http://localhost:3000`) |

### Database Setup

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### Login Credentials (after seeding)

| Email | Password | Role |
|---|---|---|
| admin@company.com | password123 | Admin |
| sarah@company.com | password123 | TPM |
| john@company.com | password123 | PL (Fenrir) |
| alice@company.com | password123 | PL (Kensei) |
| bob@company.com | password123 | PL (Talos) |

## Google Sheets Integration

1. Create a Google Cloud service account and enable the Sheets API
2. Share your employee sheet with the service account email
3. Configure these env vars:

```
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_SHEET_RANGE=Employees!A:D
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

4. Sync via Settings page or CLI:

```bash
npm run sync:sheets
```

### Sheet Format

| name | email | project | position |
|---|---|---|---|
| John Doe | john@company.com | Fenrir | Tasker |

Supported positions: TPM, PL, Project Lead, Quality Lead, Tasker, Engineering Support, Research Support

## Architecture

### User Roles

| Role | Permissions |
|---|---|
| **Admin** | Full access, manage users, import sheets, override approvals |
| **TPM** | View all projects/staffing, monitor requests, escalate |
| **PL (Project Lead)** | Create/receive requests, approve/reject, select employees |
| **Quality Lead** | View team, view affecting requests |
| **Employee** | View assignment, transfer history |

### Request Workflow

1. PL creates request → status: PENDING
2. Source PL receives notification (in-app + email)
3. Source PL reviews and selects specific employees manually
4. Source PL approves, partially approves, or rejects
5. Status updates: PENDING → APPROVED / PARTIALLY_APPROVED / REJECTED / COMPLETED

**Key rule**: Employees are never auto-selected. All transfers require explicit manual selection by the source PL.

### Database Schema

- **User** - Auth accounts with role-based access
- **Employee** - Workforce members linked to projects
- **Project** - Active projects with employees
- **ResourceRequest** - Transfer requests between projects
- **RequestApproval** - Per-employee approval records
- **Notification** - In-app notification system
- **AuditLog** - Immutable action log

### Migrating to PostgreSQL

1. Install `pg` driver: `npm install pg`
2. Update `DATABASE_URL` in `.env` to PostgreSQL connection string
3. Update `prisma/schema.prisma` datasource provider to `"postgresql"`
4. Run `npx prisma migrate dev`
5. Run `npm run db:seed`

The Prisma schema uses only SQLite/PostgreSQL-compatible features.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run sync:sheets` | Sync employees from Google Sheets |

## Docker

```bash
docker compose up --build
```

## License

Internal use.
