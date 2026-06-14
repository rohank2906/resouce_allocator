"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, History, ArrowRight, CheckCircle2, XCircle, AlertCircle, FileText,
  UserCog, Send, ShieldCheck, Plus, Sparkles
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { titleCase } from "@/lib/utils";
import { FadeUp, StaggerGroup, StaggerItem } from "@/components/motion/primitives";

interface AuditLog {
  id: string;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  createdAt: string;
  requestId?: string | null;
  user?: { name?: string | null; email: string } | null;
  request?: { title: string } | null;
}

interface AuditResponse {
  logs?: AuditLog[];
  total?: number;
}

function actionMeta(action: string) {
  const a = action.toUpperCase();
  if (a.includes("CREATE")) return { Icon: Plus, tone: "text-[hsl(243_75%_55%)] dark:text-[hsl(243_90%_72%)]", bg: "bg-accent/10 border-accent/20" };
  if (a.includes("APPROVE") || a.includes("ACCEPT")) return { Icon: CheckCircle2, tone: "text-[hsl(152_65%_38%)] dark:text-[hsl(152_60%_62%)]", bg: "bg-[hsl(152_65%_45%/0.10)] border-[hsl(152_65%_45%/0.22)]" };
  if (a.includes("REJECT") || a.includes("DENIED")) return { Icon: XCircle, tone: "text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)]", bg: "bg-[hsl(0_75%_55%/0.10)] border-[hsl(0_75%_55%/0.22)]" };
  if (a.includes("COMPLETE")) return { Icon: ShieldCheck, tone: "text-[hsl(152_65%_38%)] dark:text-[hsl(152_60%_62%)]", bg: "bg-[hsl(152_65%_45%/0.10)] border-[hsl(152_65%_45%/0.22)]" };
  if (a.includes("TRANSFER") || a.includes("MOVE")) return { Icon: Send, tone: "text-[hsl(217_85%_45%)] dark:text-[hsl(217_91%_72%)]", bg: "bg-[hsl(217_91%_60%/0.10)] border-[hsl(217_91%_60%/0.22)]" };
  if (a.includes("UPDATE") || a.includes("EDIT") || a.includes("ASSIGN")) return { Icon: UserCog, tone: "text-[hsl(35_85%_42%)] dark:text-[hsl(38_92%_68%)]", bg: "bg-[hsl(35_95%_50%/0.12)] border-[hsl(35_95%_50%/0.22)]" };
  if (a.includes("WARN")) return { Icon: AlertCircle, tone: "text-[hsl(35_85%_42%)]", bg: "bg-[hsl(35_95%_50%/0.12)] border-[hsl(35_95%_50%/0.22)]" };
  return { Icon: FileText, tone: "text-muted-foreground", bg: "bg-muted/60 border-border-subtle" };
}

export default function AuditPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["audit"],
    queryFn: () => fetch("/api/audit").then((res) => res.json())
  });

  const filtered = useMemo(() => {
    const logs = data?.logs ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) =>
      [log.action, log.user?.name, log.user?.email, log.request?.title]
        .some((field) => String(field ?? "").toLowerCase().includes(q))
    );
  }, [data?.logs, search]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const log of filtered) {
      const key = format(new Date(log.createdAt), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(log);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
  }, [filtered]);

  return (
    <div className="space-y-8">
      <FadeUp>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3 text-accent" /> Activity
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Audit Log</h1>
            <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
              Immutable record of every consequential action across the platform.
            </p>
          </div>
          {data?.total !== undefined && (
            <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-muted/30 px-4 py-2.5">
              <div>
                <div className="font-numeric text-xl font-semibold text-foreground">
                  {data.total.toLocaleString()}
                </div>
                <div className="text-2xs uppercase tracking-wider text-muted-foreground">Entries</div>
              </div>
              <div className="h-7 w-px bg-border-subtle" />
              <div>
                <div className="font-numeric text-xl font-semibold text-foreground tabular">
                  {filtered.length.toLocaleString()}
                </div>
                <div className="text-2xs uppercase tracking-wider text-muted-foreground">Showing</div>
              </div>
            </div>
          )}
        </div>
      </FadeUp>

      <FadeUp delay={0.05}>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by action, user, or request title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </FadeUp>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <History className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No audit entries</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search ? "Try a different search term." : "No actions have been recorded yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ day, items }, gi) => (
            <FadeUp key={day} delay={0.04 + gi * 0.02}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {format(new Date(day), "EEEE, MMMM d, yyyy")}
                  </span>
                  <div className="h-px flex-1 bg-border-subtle" />
                  <span className="text-2xs tabular text-muted-foreground">{items.length}</span>
                </div>
                <StaggerGroup className="relative space-y-1.5" stagger={0.03}>
                  <span aria-hidden className="absolute left-[19px] top-2 bottom-2 w-px bg-border-subtle" />
                  {items.map((log) => {
                    const meta = actionMeta(log.action);
                    const Icon = meta.Icon;
                    return (
                      <StaggerItem key={log.id}>
                        <Card className="relative ml-0">
                          <CardContent className="p-3 pl-12">
                            <span className={`absolute left-[8.5px] top-3 flex h-[22px] w-[22px] items-center justify-center rounded-full border ${meta.bg} ring-4 ring-background`}>
                              <Icon className={`h-3 w-3 ${meta.tone}`} strokeWidth={2.4} />
                            </span>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-2xs font-mono font-semibold uppercase tracking-wider">
                                    {log.action}
                                  </Badge>
                                  {log.previousStatus && log.newStatus && (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground/80">{titleCase(log.previousStatus)}</span>
                                      <ArrowRight className="h-3 w-3" />
                                      <span className="font-medium text-foreground/80">{titleCase(log.newStatus)}</span>
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1.5 text-sm text-foreground/90">
                                  <span className="font-medium">
                                    {log.user?.name || log.user?.email || "System"}
                                  </span>
                                  {log.request?.title && (
                                    <>
                                      <span className="mx-1.5 text-muted-foreground/60">·</span>
                                      <span className="text-muted-foreground">{log.request.title}</span>
                                    </>
                                  )}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground tabular">
                                  {format(new Date(log.createdAt), "h:mm:ss a")}
                                  <span className="mx-1.5 opacity-40">·</span>
                                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                </p>
                              </div>
                              {log.requestId && (
                                <Link
                                  href={`/requests/${log.requestId}`}
                                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-accent transition-colors duration-150"
                                >
                                  View
                                  <ArrowRight className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </StaggerItem>
                    );
                  })}
                </StaggerGroup>
              </div>
            </FadeUp>
          ))}
        </div>
      )}
    </div>
  );
}
