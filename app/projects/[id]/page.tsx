"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, Users, Inbox, Send, ArrowRight, GitBranch, Briefcase, Pencil, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { initials, titleCase } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { FadeUp, StaggerGroup, StaggerItem } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";

interface Employee {
  id: string;
  name: string;
  email: string;
  position: string;
  attendanceStatus: "PRESENT" | "LEAVE" | "ABSENT" | "UNKNOWN" | null;
}

interface ProjectRequest {
  id: string;
  status: string;
  taskersNeeded: number;
  qualityLeadsNeeded: number;
  plNeeded?: number;
  requestingProject?: { name: string };
  sourceProject?: { name: string };
}

interface ProjectDetail {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  employees?: Employee[];
  incomingRequests?: ProjectRequest[];
  outgoingRequests?: ProjectRequest[];
}

const POSITION_VARIANTS: Record<string, "default" | "secondary" | "outline" | "success" | "warning" | "info" | "accent"> = {
  PL: "success",
  QUALITY_LEAD: "info",
  TPM: "warning",
  TASKER: "secondary",
  INTERN_TASKER: "outline",
  ENGINEERING_SUPPORT: "default",
  RESEARCH_SUPPORT: "accent"
};

const STATUS_VARIANT: Record<string, "warning" | "success" | "info" | "destructive" | "default"> = {
  PENDING: "warning",
  APPROVED: "success",
  PARTIALLY_APPROVED: "info",
  REJECTED: "destructive",
  COMPLETED: "default"
};

interface StatTileProps {
  title: string;
  value: number;
  icon: React.ElementType;
  tone?: "default" | "accent" | "warning" | "success";
  hint?: string;
}

function StatTile({ title, value, icon: Icon, tone = "default", hint }: StatTileProps) {
  const toneStyles =
    tone === "accent"
      ? "from-[hsl(243_85%_64%/0.18)] to-transparent"
      : tone === "warning"
      ? "from-[hsl(35_95%_55%/0.18)] to-transparent"
      : tone === "success"
      ? "from-[hsl(152_65%_50%/0.18)] to-transparent"
      : "from-[hsl(220_15%_50%/0.10)] to-transparent";

  return (
    <Card className="relative overflow-hidden">
      <div className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${toneStyles} blur-2xl`} />
      <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-muted/60 text-muted-foreground">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <span className="font-numeric text-3xl font-semibold tracking-tight text-foreground">
          <AnimatedCounter value={value} />
        </span>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = can(role, "manageProjects");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ["project", params.id],
    queryFn: () => fetch(`/api/projects/${params.id}`).then((res) => res.json())
  });

  const chartData = useMemo(() => {
    if (!project?.employees) return [];
    const dist: Record<string, number> = {};
    for (const emp of project.employees) {
      dist[emp.position] = (dist[emp.position] || 0) + 1;
    }
    return Object.entries(dist)
      .map(([position, count]) => ({ position: titleCase(position), employees: count }))
      .sort((a, b) => b.employees - a.employees);
  }, [project?.employees]);

  const attendanceCounts = useMemo(() => {
    const empty = { present: 0, leave: 0, absent: 0, unknown: 0, unsynced: 0 };
    if (!project?.employees) return empty;
    for (const e of project.employees) {
      switch (e.attendanceStatus) {
        case "PRESENT": empty.present++; break;
        case "LEAVE": empty.leave++; break;
        case "ABSENT": empty.absent++; break;
        case "UNKNOWN": empty.unknown++; break;
        default: empty.unsynced++; break;
      }
    }
    return empty;
  }, [project?.employees]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-9 w-1/3" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <GitBranch className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground">Project not found</p>
        <Button variant="outline" size="sm" asChild className="mt-2">
          <Link href="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <FadeUp>
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            All projects
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Briefcase className="h-3 w-3 text-accent" /> Project
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
                {project.name}
              </h1>
              {project.description && (
                <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl text-pretty">
                  {project.description}
                </p>
              )}
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  className="text-[hsl(0_72%_50%)] hover:text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </FadeUp>

      <StaggerGroup className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" delay={0.05}>
        <StaggerItem>
          <StatTile title="Total Members" value={project.employees?.length ?? 0} icon={Users} tone="default" />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            title="Present"
            value={attendanceCounts.present}
            icon={Users}
            tone="success"
            hint={attendanceCounts.unsynced ? `${attendanceCounts.unsynced} not synced` : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            title="On Leave"
            value={attendanceCounts.leave}
            icon={Users}
            tone="warning"
            hint={attendanceCounts.absent ? `+ ${attendanceCounts.absent} absent` : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile title="Incoming" value={project.incomingRequests?.length ?? 0} icon={Inbox} tone="accent" />
        </StaggerItem>
        <StaggerItem>
          <StatTile title="Outgoing" value={project.outgoingRequests?.length ?? 0} icon={Send} tone="default" />
        </StaggerItem>
      </StaggerGroup>

      <FadeUp delay={0.08}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Attendance progress</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Live breakdown of who is in vs out today.</p>
          </CardHeader>
          <CardContent>
            <AttendanceBar counts={attendanceCounts} total={project.employees?.length ?? 0} />
          </CardContent>
        </Card>
      </FadeUp>

      <FadeUp delay={0.15}>
        <Tabs defaultValue="staffing">
          <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="staffing">Staffing</TabsTrigger>
            <TabsTrigger value="incoming">
              Incoming
              {project.incomingRequests && project.incomingRequests.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-accent/15 px-1.5 text-2xs font-semibold text-accent tabular">
                  {project.incomingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="outgoing">
              Outgoing
              {project.outgoingRequests && project.outgoingRequests.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-accent/15 px-1.5 text-2xs font-semibold text-accent tabular">
                  {project.outgoingRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="staffing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Position Distribution</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Headcount by role within this project</p>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                      <defs>
                        <linearGradient id="prjBarFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(243 85% 64%)" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(262 80% 60%)" stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border-strong) / 0.4)" vertical={false} />
                      <XAxis
                        dataKey="position"
                        tick={{ fontSize: 11, fill: "hsl(var(--foreground) / 0.65)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--foreground) / 0.55)" }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--accent) / 0.08)" }}
                        contentStyle={{
                          background: "hsl(var(--surface-overlay))",
                          border: "1px solid hsl(var(--border-strong))",
                          borderRadius: 10,
                          fontSize: 12,
                          boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.3)",
                          color: "hsl(var(--foreground))"
                        }}
                        labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 500 }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="employees" fill="url(#prjBarFill)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyInline icon={Users}>No employees in this project yet</EmptyInline>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Roster</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {project.employees?.length ?? 0} {project.employees?.length === 1 ? "member" : "members"} currently assigned
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {project.employees && project.employees.length > 0 ? (
                  <StaggerGroup className="grid gap-2 sm:grid-cols-2" stagger={0.02}>
                    {project.employees.map((emp) => (
                      <StaggerItem key={emp.id}>
                        <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-border hover:bg-muted/40">
                          <Avatar className="h-8 w-8 border border-border-subtle">
                            <AvatarFallback className="bg-gradient-to-br from-[hsl(243_75%_60%/0.16)] to-[hsl(262_75%_60%/0.16)] text-2xs font-medium text-foreground">
                              {initials(emp.name, emp.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                          </div>
                          <Badge variant={POSITION_VARIANTS[emp.position] ?? "default"} className="shrink-0">
                            {titleCase(emp.position)}
                          </Badge>
                        </div>
                      </StaggerItem>
                    ))}
                  </StaggerGroup>
                ) : (
                  <EmptyInline icon={Users}>No employees assigned</EmptyInline>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incoming">
            <RequestList
              items={project.incomingRequests ?? []}
              flavor="incoming"
              currentName={project.name}
            />
          </TabsContent>

          <TabsContent value="outgoing">
            <RequestList
              items={project.outgoingRequests ?? []}
              flavor="outgoing"
              currentName={project.name}
            />
          </TabsContent>
        </Tabs>
      </FadeUp>

      <EditProjectDialog
        project={canManage ? {
          id: project.id,
          name: project.name,
          type: project.type ?? null,
          status: project.status ?? null,
          description: project.description ?? null
        } : null}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteProjectDialog
        project={canManage ? {
          id: project.id,
          name: project.name,
          employeeCount: project.employees?.length ?? 0
        } : null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        redirectAfterDelete="/projects"
      />
    </div>
  );
}

function RequestList({
  items,
  flavor,
  currentName
}: {
  items: ProjectRequest[];
  flavor: "incoming" | "outgoing";
  currentName: string;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            {flavor === "incoming" ? <Inbox className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          </div>
          <p className="text-sm font-medium text-foreground">
            No {flavor} requests
          </p>
          <p className="text-xs text-muted-foreground">
            {flavor === "incoming"
              ? "No other projects have requested resources from this one yet."
              : "This project hasn't requested resources from any other project yet."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <StaggerGroup className="space-y-2.5" stagger={0.03}>
      {items.map((req) => {
        const counterparty =
          flavor === "incoming"
            ? req.requestingProject?.name ?? "—"
            : req.sourceProject?.name ?? "—";
        const totalNeeded =
          (req.plNeeded ?? 0) + (req.qualityLeadsNeeded ?? 0) + (req.taskersNeeded ?? 0);
        return (
          <StaggerItem key={req.id}>
            <Link href={`/requests/${req.id}`} className="group block">
              <Card interactive>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors duration-150">
                        {flavor === "incoming" ? counterparty : currentName}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-sm font-medium text-foreground/80">
                        {flavor === "incoming" ? currentName : counterparty}
                      </span>
                      <Badge variant={STATUS_VARIANT[req.status] ?? "default"} dot>
                        {titleCase(req.status)}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="tabular">{req.taskersNeeded}</span> Taskers
                      {req.qualityLeadsNeeded > 0 && (
                        <>
                          <span className="mx-1.5 opacity-40">·</span>
                          <span className="tabular">{req.qualityLeadsNeeded}</span> Quality Leads
                        </>
                      )}
                      {req.plNeeded ? (
                        <>
                          <span className="mx-1.5 opacity-40">·</span>
                          <span className="tabular">{req.plNeeded}</span> PLs
                        </>
                      ) : null}
                      {totalNeeded > 0 && (
                        <>
                          <span className="mx-1.5 opacity-40">·</span>
                          <span className="font-numeric font-medium text-foreground/80">{totalNeeded}</span> total
                        </>
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-220 group-hover:opacity-100 group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          </StaggerItem>
        );
      })}
    </StaggerGroup>
  );
}

function EmptyInline({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <Icon className="h-5 w-5 opacity-60" />
      {children}
    </div>
  );
}

function AttendanceBar({
  counts,
  total
}: {
  counts: { present: number; leave: number; absent: number; unknown: number; unsynced: number };
  total: number;
}) {
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No members assigned to this project.</p>;
  }
  const segments = [
    { key: "present", label: "Present", value: counts.present, fill: "bg-[hsl(152_65%_52%)]" },
    { key: "leave", label: "On Leave", value: counts.leave, fill: "bg-[hsl(35_95%_60%)]" },
    { key: "absent", label: "Absent", value: counts.absent, fill: "bg-[hsl(0_75%_60%)]" },
    { key: "unknown", label: "Unknown", value: counts.unknown, fill: "bg-[hsl(220_12%_65%)]" },
    { key: "unsynced", label: "Not Synced", value: counts.unsynced, fill: "bg-[hsl(220_12%_80%)]" }
  ];
  const presentPct = Math.round((counts.present / total) * 100);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-foreground/80">
          <span className="font-numeric font-semibold text-foreground tabular">{presentPct}%</span> present today
        </p>
        <p className="text-xs text-muted-foreground tabular">
          {counts.present} present · {counts.leave} on leave · {total} total
        </p>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s) => {
          if (s.value === 0) return null;
          const pct = (s.value / total) * 100;
          return (
            <div
              key={s.key}
              className={`h-full ${s.fill} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.value}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {segments.map((s) => (
          s.value > 0 ? (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${s.fill}`} />
              <span className="text-foreground/80">{s.label}</span>
              <span className="text-muted-foreground tabular">{s.value}</span>
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
}
