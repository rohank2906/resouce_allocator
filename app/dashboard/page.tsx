"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  GitBranch,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Briefcase,
  UserPlus,
  RefreshCw,
  UserCheck,
  CalendarOff
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import Link from "next/link";
import { cn, titleCase } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { FadeUp, StaggerGroup, StaggerItem } from "@/components/motion/primitives";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { CreateEmployeeDialog } from "@/components/employees/create-employee-dialog";

const CHART_COLORS = [
  "hsl(243 85% 66%)",
  "hsl(217 91% 64%)",
  "hsl(152 65% 52%)",
  "hsl(35 95% 60%)",
  "hsl(262 85% 70%)",
  "hsl(200 90% 60%)",
  "hsl(330 80% 66%)"
];

interface TooltipPayloadEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

function ChartTooltip({
  active,
  payload,
  label,
  valueLabel = "Employees"
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  valueLabel?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  const displayLabel = label ?? first.name ?? "";
  return (
    <div className="rounded-lg border border-border-strong bg-surface-overlay px-3 py-2 text-xs shadow-lifted dark:bg-surface-raised">
      {displayLabel !== "" && (
        <p className="mb-1 font-display text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {typeof displayLabel === "string" ? titleCase(displayLabel) : displayLabel}
        </p>
      )}
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: first.color ?? "hsl(var(--accent))" }}
        />
        <span className="font-numeric text-sm font-semibold text-foreground">{first.value}</span>
        <span className="text-[11px] text-muted-foreground">{valueLabel.toLowerCase()}</span>
      </div>
    </div>
  );
}

interface StatTileProps {
  title: string;
  value: number;
  icon: React.ElementType;
  hint?: string;
  tone?: "default" | "accent" | "warning" | "success";
}

function StatTile({ title, value, icon: Icon, hint, tone = "default" }: StatTileProps) {
  const toneStyles =
    tone === "accent"
      ? "from-[hsl(243_85%_64%/0.18)] to-transparent"
      : tone === "warning"
      ? "from-[hsl(35_95%_55%/0.18)] to-transparent"
      : tone === "success"
      ? "from-[hsl(152_65%_50%/0.18)] to-transparent"
      : "from-[hsl(220_15%_50%/0.10)] to-transparent";

  const iconStyles =
    tone === "accent"
      ? "border-accent/20 bg-accent/10 text-accent"
      : tone === "warning"
      ? "border-[hsl(35_95%_55%/0.25)] bg-[hsl(35_95%_55%/0.10)] text-[hsl(28_85%_42%)] dark:text-[hsl(38_92%_72%)]"
      : tone === "success"
      ? "border-[hsl(152_65%_45%/0.25)] bg-[hsl(152_65%_45%/0.10)] text-[hsl(152_65%_38%)] dark:text-[hsl(152_65%_62%)]"
      : "border-border-subtle bg-muted/60 text-muted-foreground";

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/[0.06] dark:hover:shadow-black/40">
      <div className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${toneStyles} blur-2xl transition-opacity duration-300 group-hover:opacity-80`} />
      <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </CardTitle>
        </div>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", iconStyles)}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      </CardHeader>
      <CardContent className="relative flex flex-1 flex-col justify-end">
        <div className="flex items-baseline gap-1">
          <span className="font-numeric text-3xl font-semibold tracking-tight text-foreground">
            <AnimatedCounter value={value} />
          </span>
        </div>
        <p className="mt-1 min-h-[1.25rem] text-xs text-muted-foreground">{hint ?? ""}</p>
      </CardContent>
    </Card>
  );
}

interface DashboardResponse {
  totalEmployees?: number;
  activeRequests?: number;
  attendance?: {
    present: number;
    leave: number;
    absent: number;
    unknown: number;
    unsynced: number;
    lastSyncedAt: string | null;
  };
  employeesByProject?: Array<{ project: string; employees: number }>;
  employeesByPosition?: Array<{ position: string; employees: number }>;
  requestsByStatus?: Array<{ status: string; requests: number }>;
  recentRequests?: Array<{
    id: string;
    title: string;
    status: string;
    requestingProject?: { name: string };
    sourceProject?: { name: string };
  }>;
}

const ATTENDANCE_TONES: Record<string, { fill: string; stroke: string }> = {
  PRESENT: { fill: "hsl(152 65% 52%)", stroke: "hsl(152 65% 38%)" },
  LEAVE: { fill: "hsl(35 95% 60%)", stroke: "hsl(28 85% 42%)" },
  ABSENT: { fill: "hsl(0 75% 60%)", stroke: "hsl(0 75% 45%)" },
  UNKNOWN: { fill: "hsl(220 12% 65%)", stroke: "hsl(220 12% 45%)" },
  UNSYNCED: { fill: "hsl(220 12% 80%)", stroke: "hsl(220 12% 55%)" }
};

const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: "Present",
  LEAVE: "On Leave",
  ABSENT: "Absent",
  UNKNOWN: "Unknown",
  UNSYNCED: "Not Synced"
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const role = (session?.user as { role?: Role } | undefined)?.role;
  const canCreateProject = can(role, "manageProjects");
  const canCreateEmployee = can(role, "manageEmployees");
  const canSync = can(role, "manageSync");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      return json as { imported: number; updated: number; errors: unknown[] };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["sync"] });
      toast.success(
        `Synced ${result.imported} new, ${result.updated} updated, ${result.errors.length} errors`
      );
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const { data, isLoading } = useQuery<DashboardResponse>({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/dashboard").then((res) => res.json())
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const statusColor: Record<string, "warning" | "success" | "info" | "destructive" | "default"> = {
    PENDING: "warning",
    APPROVED: "success",
    PARTIALLY_APPROVED: "info",
    REJECTED: "destructive",
    COMPLETED: "default"
  };

  const pending =
    (data?.requestsByStatus ?? []).find((r) => r.status === "PENDING")?.requests ?? 0;

  return (
    <div className="space-y-8">
      <FadeUp>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3 text-accent" /> Overview
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
              Dashboard
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
              Live snapshot of workforce, projects, and active resource requests.
            </p>
          </div>
          {(canCreateProject || canCreateEmployee || canSync) && (
            <div className="flex flex-wrap items-center gap-2">
              {canSync && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Syncing" : "Sync now"}
                </Button>
              )}
              {canCreateProject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProjectDialogOpen(true)}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  New project
                </Button>
              )}
              {canCreateEmployee && (
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => setEmployeeDialogOpen(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add employee
                </Button>
              )}
            </div>
          )}
        </div>
      </FadeUp>

      <FadeUp delay={0.04}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
            At a glance
          </h2>
          <p className="text-xs text-muted-foreground tabular">
            {data?.attendance?.lastSyncedAt
              ? <>Last RS sync {formatDistanceToNow(new Date(data.attendance.lastSyncedAt), { addSuffix: true })}</>
              : <>RS sheet has not been synced yet</>}
          </p>
        </div>
      </FadeUp>

      <StaggerGroup
        className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        delay={0.05}
      >
        <StaggerItem>
          <StatTile
            title="Present"
            value={data?.attendance?.present ?? 0}
            icon={UserCheck}
            tone="success"
            hint={data?.totalEmployees ? `of ${data.totalEmployees.toLocaleString()} total` : "today"}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            title="On Leave"
            value={data?.attendance?.leave ?? 0}
            icon={CalendarOff}
            tone="warning"
            hint={data?.attendance?.absent ? `+ ${data.attendance.absent} absent` : "today"}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            title="Total Employees"
            value={data?.totalEmployees ?? 0}
            icon={Users}
            tone="default"
            hint={data?.attendance?.unsynced ? `${data.attendance.unsynced.toLocaleString()} unsynced` : "all sources"}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            title="Projects"
            value={data?.employeesByProject?.length ?? 0}
            icon={GitBranch}
            tone="default"
            hint="active"
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            title="Requests"
            value={data?.activeRequests ?? 0}
            icon={FileText}
            tone="accent"
            hint="in flight"
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            title="Pending"
            value={pending}
            icon={Clock}
            tone="warning"
            hint="awaiting PL"
          />
        </StaggerItem>
      </StaggerGroup>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 [&>*]:h-full">
        <FadeUp delay={0.1}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Employees by Project</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Live headcount across active projects</p>
              </div>
            </CardHeader>
            <CardContent>
              {data?.employeesByProject && data.employeesByProject.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.employeesByProject} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(243 85% 64%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(243 80% 58%)" stopOpacity={0.85} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border-strong) / 0.4)" vertical={false} />
                    <XAxis
                      dataKey="project"
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
                      content={<ChartTooltip valueLabel="Employees" />}
                    />
                    <Bar dataKey="employees" fill="url(#barFill)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No project data</EmptyState>
              )}
            </CardContent>
          </Card>
        </FadeUp>

        <FadeUp delay={0.16}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Employees by Position</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Role composition across the org</p>
            </CardHeader>
            <CardContent>
              {data?.employeesByPosition && data.employeesByPosition.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.employeesByPosition}
                      dataKey="employees"
                      nameKey="position"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={96}
                      paddingAngle={2}
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {data.employeesByPosition.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip valueLabel="Employees" />} />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => (
                        <span className="text-xs text-foreground/80">{titleCase(value)}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No position data</EmptyState>
              )}
            </CardContent>
          </Card>
        </FadeUp>

        <FadeUp delay={0.2}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Attendance breakdown</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Live present/leave split across the workforce</p>
            </CardHeader>
            <CardContent>
              {data?.attendance ? (
                (() => {
                  const segments = [
                    { key: "PRESENT", value: data.attendance.present },
                    { key: "LEAVE", value: data.attendance.leave },
                    { key: "ABSENT", value: data.attendance.absent },
                    { key: "UNKNOWN", value: data.attendance.unknown },
                    { key: "UNSYNCED", value: data.attendance.unsynced }
                  ].filter((s) => s.value > 0);
                  if (segments.length === 0) return <EmptyState>No attendance data</EmptyState>;
                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={segments}
                          dataKey="value"
                          nameKey="key"
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={96}
                          paddingAngle={2}
                          strokeWidth={2}
                          stroke="hsl(var(--background))"
                        >
                          {segments.map((s) => (
                            <Cell key={s.key} fill={ATTENDANCE_TONES[s.key].fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip valueLabel="Employees" />} />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                          formatter={(value: string) => (
                            <span className="text-xs text-foreground/80">{ATTENDANCE_LABELS[value] ?? value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()
              ) : (
                <EmptyState>No attendance data</EmptyState>
              )}
            </CardContent>
          </Card>
        </FadeUp>

        <FadeUp delay={0.22}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Recent Requests</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Latest transfer activity</p>
              </div>
              <Link
                href="/requests"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {data?.recentRequests && data.recentRequests.length > 0 ? (
                <ul className="divide-y divide-border-subtle">
                  {data.recentRequests.map((req) => (
                    <li key={req.id}>
                      <Link
                        href={`/requests/${req.id}`}
                        className="group flex items-center justify-between gap-3 py-3 transition-colors duration-150"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
                            {req.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5">
                            <span>{req.requestingProject?.name}</span>
                            <ArrowRight className="h-3 w-3 opacity-60" />
                            <span>{req.sourceProject?.name}</span>
                          </p>
                        </div>
                        <Badge variant={statusColor[req.status] ?? "default"} dot>
                          {titleCase(req.status)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>No requests yet</EmptyState>
              )}
            </CardContent>
          </Card>
        </FadeUp>
      </div>

      <CreateProjectDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} />
      <CreateEmployeeDialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen} />
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
