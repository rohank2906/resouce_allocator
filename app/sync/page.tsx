"use client";

import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Sparkles,
  Settings2,
  Clock,
  CalendarCheck,
  ExternalLink
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { FadeUp, StaggerGroup, StaggerItem } from "@/components/motion/primitives";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";
import { useToast } from "@/lib/toast";

interface SyncHistoryEntry {
  id: string;
  source: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  imported: number;
  updated: number;
  duplicates: number;
  errors: Array<{ row: number; email?: string; reason: string }> | null;
  durationMs: number;
  message: string | null;
  startedAt: string;
  completedAt: string | null;
  startedBy: { id: string; name: string | null; email: string } | null;
}

interface SyncSource {
  key: "GOOGLE_SHEET" | "RS_SHEET";
  label: string;
  description: string;
  sheetId: string | null;
  range: string;
  endpoint: string;
  isConfigured: boolean;
  lastSuccess: SyncHistoryEntry | null;
}

interface SyncResponse {
  history: SyncHistoryEntry[];
  sources: SyncSource[];
  isConfigured: boolean;
}

const STATUS_VARIANT: Record<SyncHistoryEntry["status"], "warning" | "success" | "info" | "destructive" | "default"> = {
  RUNNING: "info",
  SUCCESS: "success",
  PARTIAL: "warning",
  FAILED: "destructive"
};

const SOURCE_LABEL: Record<string, string> = {
  GOOGLE_SHEET: "Employees",
  RS_SHEET: "Resource Segregation"
};

export default function SyncCenterPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canSync = can(role, "manageSync");

  const { data, isLoading } = useQuery<SyncResponse>({
    queryKey: ["sync"],
    queryFn: () => fetch("/api/sync").then((r) => r.json()),
    refetchInterval: (query) => {
      const lastHistory = query.state.data?.history?.[0];
      return lastHistory?.status === "RUNNING" ? 2000 : false;
    }
  });

  const syncMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      return { endpoint, result: json };
    },
    onSuccess: ({ endpoint, result }) => {
      queryClient.invalidateQueries({ queryKey: ["sync"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (endpoint === "/api/sync/rs") {
        toast.success(
          `Sync complete. ${result.attendanceUpdated ?? 0} attendance · ${result.projectMoved ?? 0} moves · ${result.errors?.length ?? 0} errors`
        );
      } else {
        toast.success(
          `Sync complete. ${result.imported ?? 0} new · ${result.updated ?? 0} updated · ${result.errors?.length ?? 0} errors`
        );
      }
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const runningSource = data?.history?.find((h) => h.status === "RUNNING")?.source;
  const isRunning = (sourceKey: string) =>
    syncMutation.isPending || runningSource === sourceKey;

  return (
    <div className="max-w-5xl space-y-7">
      <FadeUp>
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" /> Sync Center
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Google Sheets sync
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
            Pull the latest workforce roster and daily attendance from the configured spreadsheets. Email is the unique key for both sources.
          </p>
        </div>
      </FadeUp>

      <div className="grid gap-5 md:grid-cols-2">
        {(isLoading || !data
          ? [null, null]
          : data.sources
        ).map((source, i) => (
          <FadeUp key={source?.key ?? i} delay={0.05 + i * 0.04}>
            <SourceCard
              source={source}
              canSync={canSync}
              isPending={source ? isRunning(source.key) : false}
              onSync={(endpoint) => syncMutation.mutate(endpoint)}
            />
          </FadeUp>
        ))}
      </div>

      <FadeUp delay={0.15}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
            <CardDescription>Recent sync runs across all sources, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : (data?.history?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">No sync runs yet</p>
                <p className="text-xs text-muted-foreground">
                  Trigger the first sync with a Sync now button above.
                </p>
              </div>
            ) : (
              <StaggerGroup className="space-y-2" stagger={0.03}>
                {data?.history.map((entry) => (
                  <StaggerItem key={entry.id}>
                    <SyncEntry entry={entry} />
                  </StaggerItem>
                ))}
              </StaggerGroup>
            )}
          </CardContent>
        </Card>
      </FadeUp>
    </div>
  );
}

function SourceCard({
  source,
  canSync,
  isPending,
  onSync
}: {
  source: SyncSource | null;
  canSync: boolean;
  isPending: boolean;
  onSync: (endpoint: string) => void;
}) {
  if (!source) {
    return (
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-9 w-28" />
        </CardContent>
      </Card>
    );
  }

  const Icon = source.key === "RS_SHEET" ? CalendarCheck : Database;
  const sheetUrl = source.sheetId
    ? `https://docs.google.com/spreadsheets/d/${source.sheetId}/edit`
    : null;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-muted/60 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base">{source.label}</CardTitle>
          <CardDescription className="mt-1">{source.description}</CardDescription>
        </div>
        <Badge variant={source.isConfigured ? "success" : "warning"} dot>
          {source.isConfigured ? "Configured" : "Setup needed"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-border-subtle bg-muted/30 px-3.5 py-2.5">
          <dt className="text-2xs uppercase tracking-wider text-muted-foreground">Sheet</dt>
          <dd className="mt-1 font-numeric text-xs text-foreground break-all flex items-center gap-1.5">
            {source.sheetId ? (
              sheetUrl ? (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-accent transition-colors truncate"
                >
                  <span className="truncate">{source.sheetId}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                </a>
              ) : (
                source.sheetId
              )
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </dd>
          <p className="mt-1 text-2xs text-muted-foreground tabular">
            Range <span className="text-foreground/80">{source.range}</span>
          </p>
        </div>

        {source.lastSuccess && (
          <div className="rounded-md border border-[hsl(152_65%_45%/0.3)] bg-[hsl(152_65%_45%/0.06)] px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(152_65%_38%)] dark:text-[hsl(152_65%_62%)]" />
              <p className="text-xs font-medium text-foreground">Last successful sync</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {source.lastSuccess.completedAt
                ? formatDistanceToNow(new Date(source.lastSuccess.completedAt), { addSuffix: true })
                : "—"}
              {source.lastSuccess.message && (
                <>
                  <span className="mx-1.5 opacity-40">·</span>
                  <span className="tabular">{source.lastSuccess.message}</span>
                </>
              )}
            </p>
          </div>
        )}

        {!source.isConfigured && (
          <div className="flex items-start gap-2.5 rounded-md border border-[hsl(35_95%_50%/0.35)] bg-[hsl(35_95%_50%/0.08)] px-3 py-2.5">
            <Settings2 className="h-3.5 w-3.5 shrink-0 mt-px text-[hsl(28_85%_42%)] dark:text-[hsl(38_92%_72%)]" />
            <div className="text-xs text-[hsl(28_85%_35%)] dark:text-[hsl(38_92%_75%)] leading-relaxed">
              <p className="font-medium">
                Set{" "}
                <span className="font-numeric">
                  {source.key === "RS_SHEET" ? "GOOGLE_RS_SHEET_ID" : "GOOGLE_SHEET_ID"}
                </span>{" "}
                in <span className="font-numeric">.env</span>
              </p>
              <p className="mt-0.5 opacity-90">
                Also requires service account credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY) or GOOGLE_SHEETS_API_KEY for public sheets.
              </p>
            </div>
          </div>
        )}

        {canSync && (
          <Button
            variant="accent"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => onSync(source.endpoint)}
            disabled={isPending || !source.isConfigured}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            {isPending ? "Syncing..." : "Sync now"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SyncEntry({ entry }: { entry: SyncHistoryEntry }) {
  const Icon = entry.status === "SUCCESS"
    ? CheckCircle2
    : entry.status === "PARTIAL"
    ? AlertTriangle
    : entry.status === "FAILED"
    ? XCircle
    : Loader2;
  const tone = STATUS_VARIANT[entry.status];
  const sourceLabel = SOURCE_LABEL[entry.source] ?? entry.source;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-muted/20 px-3.5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface">
        <Icon
          className={`h-3.5 w-3.5 ${entry.status === "RUNNING" ? "animate-spin" : ""}`}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tone} dot>{entry.status}</Badge>
          <Badge variant="outline">{sourceLabel}</Badge>
          <span className="text-xs text-muted-foreground tabular">
            {format(new Date(entry.startedAt), "MMM d, HH:mm:ss")}
          </span>
          {entry.startedBy && (
            <>
              <span className="text-xs text-muted-foreground/60">·</span>
              <span className="text-xs text-muted-foreground truncate">
                {entry.startedBy.name ?? entry.startedBy.email}
              </span>
            </>
          )}
        </div>
        {entry.message && (
          <p className="text-xs text-foreground/80">{entry.message}</p>
        )}
        <div className="flex flex-wrap gap-3 text-2xs text-muted-foreground tabular">
          <span><span className="text-foreground font-medium">{entry.imported}</span> new</span>
          <span><span className="text-foreground font-medium">{entry.updated}</span> updated</span>
          <span><span className="text-foreground font-medium">{entry.duplicates}</span> dupes</span>
          <span><span className="text-foreground font-medium">{entry.errors?.length ?? 0}</span> errors</span>
          <span>{entry.durationMs}ms</span>
        </div>
      </div>
    </div>
  );
}
