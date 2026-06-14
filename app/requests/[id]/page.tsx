"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft, Check, X, Plus, AlertTriangle, ShieldCheck, Trash2, Search, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { titleCase } from "@/lib/utils";
import { useToast } from "@/lib/toast";
import { parseSearchTokens, matchEmployee, flattenPastedList } from "@/lib/employee-search";
import type { Role } from "@prisma/client";
import { FadeUp, StaggerGroup, StaggerItem } from "@/components/motion/primitives";
import { AnimatePresence, motion } from "framer-motion";

type CandSide = "REQUESTER" | "SOURCE";
type CandDecisionEnum = "PENDING" | "ACCEPTED" | "REJECTED";

interface Candidate {
  id: string;
  proposedBy: CandSide;
  requesterDecision: CandDecisionEnum;
  sourceDecision: CandDecisionEnum;
  note: string | null;
  createdAt: string;
  employee: { id: string; name: string; email: string; position: string; project: { id: string; name: string } | null };
  proposer: { id: string; name: string | null; email: string };
}

interface RequestDetail {
  id: string;
  title: string;
  status: "PENDING" | "PARTIALLY_APPROVED" | "APPROVED" | "REJECTED" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  justification: string;
  requiredBy: string;
  plNeeded: number;
  qualityLeadsNeeded: number;
  taskersNeeded: number;
  createdBy: { id: string; name: string | null; email: string };
  requestingProject: { id: string; name: string };
  sourceProject: { id: string; name: string };
  candidates: Candidate[];
}

interface Employee {
  id: string;
  name: string;
  email: string;
  position: string;
  project: { id: string; name: string } | null;
}

const STATUS_VARIANT: Record<string, "default" | "warning" | "info" | "success" | "destructive"> = {
  PENDING: "warning",
  PARTIALLY_APPROVED: "info",
  APPROVED: "success",
  COMPLETED: "success",
  REJECTED: "destructive"
};

type RoleKey = "PL" | "QUALITY_LEAD" | "TASKER";

const ROLE_GROUPS: { key: RoleKey; label: string; positions: string[]; need: keyof RequestDetail }[] = [
  { key: "PL", label: "Project Leads", positions: ["PL"], need: "plNeeded" },
  { key: "QUALITY_LEAD", label: "Quality Leads", positions: ["QUALITY_LEAD"], need: "qualityLeadsNeeded" },
  { key: "TASKER", label: "Taskers", positions: ["TASKER", "INTERN_TASKER"], need: "taskersNeeded" }
];

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const userId = session?.user?.id as string | undefined;

  const { data: request, isLoading } = useQuery<RequestDetail>({
    queryKey: ["request", params.id],
    queryFn: () => fetch(`/api/requests/${params.id}`).then((r) => r.json())
  });

  const { data: viewer } = useQuery<Employee | null>({
    queryKey: ["viewer-employee", userId],
    queryFn: () =>
      fetch(`/api/employees?search=${encodeURIComponent(session?.user?.email ?? "")}`)
        .then((r) => r.json())
        .then((arr: Employee[]) => arr.find((e) => e.email === session?.user?.email) ?? null),
    enabled: !!session?.user?.email
  });

  const sourceProjectId = request?.sourceProject.id;
  const { data: sourceRoster } = useQuery<Employee[]>({
    queryKey: ["employees", "by-project", sourceProjectId],
    queryFn: () => fetch(`/api/employees?projectId=${sourceProjectId}`).then((r) => r.json()),
    enabled: !!sourceProjectId
  });

  const sides = useMemo(() => {
    const isAdmin = role === "ADMIN";
    const isPL = role === "PL";
    const isOnRequesting = !!viewer && !!request && viewer.project?.id === request.requestingProject.id;
    const isOnSource = !!viewer && !!request && viewer.project?.id === request.sourceProject.id;
    return {
      isAdmin,
      canActAsRequester: isAdmin || (isPL && isOnRequesting),
      canActAsSource: isAdmin || (isPL && isOnSource)
    };
  }, [role, viewer, request]);

  const addMutation = useMutation({
    mutationFn: async (payload: { employeeId: string; side: CandSide }) => {
      const res = await fetch(`/api/requests/${params.id}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request", params.id] });
      toast.success("Candidate added");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const decideMutation = useMutation({
    mutationFn: async (p: { cid: string; side: CandSide; decision: "ACCEPTED" | "REJECTED" }) => {
      const res = await fetch(`/api/requests/${params.id}/candidates/${p.cid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: p.side, decision: p.decision })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request", params.id] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const removeMutation = useMutation({
    mutationFn: async (cid: string) => {
      const res = await fetch(`/api/requests/${params.id}/candidates/${cid}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request", params.id] });
      toast.success("Candidate removed");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/requests/${params.id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({})
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request", params.id] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Request rejected");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const forceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/requests/${params.id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request", params.id] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Request force-completed");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Request not found</p>
        <Button variant="outline" className="mt-4" asChild><Link href="/requests">Back</Link></Button>
      </div>
    );
  }

  const closed = request.status === "COMPLETED" || request.status === "REJECTED";

  const candidatesByGroup = (key: RoleKey) => {
    const group = ROLE_GROUPS.find((g) => g.key === key)!;
    return request.candidates.filter((c) => group.positions.includes(c.employee.position));
  };

  const finalizedCount = (key: RoleKey) =>
    candidatesByGroup(key).filter((c) => c.requesterDecision === "ACCEPTED" && c.sourceDecision === "ACCEPTED").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/requests"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{request.title}</h1>
            <Badge variant={STATUS_VARIANT[request.status] ?? "default"}>{titleCase(request.status)}</Badge>
            <Badge variant={request.priority === "CRITICAL" ? "destructive" : request.priority === "HIGH" ? "warning" : "outline"}>
              {titleCase(request.priority)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {request.requestingProject.name} ← {request.sourceProject.name} · by {request.createdBy.name ?? request.createdBy.email} · needed by {format(new Date(request.requiredBy), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
          <CardDescription className="text-pretty">{request.justification}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {ROLE_GROUPS.map((g) => {
              const need = request[g.need] as number;
              const filled = finalizedCount(g.key);
              const pct = need === 0 ? 100 : Math.min(100, Math.round((filled / need) * 100));
              const done = need === 0 || filled >= need;
              return (
                <div key={g.key} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{g.label}</span>
                    <span className={`text-sm tabular ${done ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                      {filled}/{need}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full transition-all ${done ? "bg-emerald-500" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {sides.isAdmin && !closed && (
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => forceMutation.mutate()} disabled={forceMutation.isPending}>
                <ShieldCheck className="mr-1.5 h-4 w-4" /> Admin force-complete
              </Button>
            </div>
          )}
          {!closed && (sides.canActAsSource || sides.isAdmin) && (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                Reject request
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {ROLE_GROUPS.map((g) => (
        <RoleSection
          key={g.key}
          request={request}
          sourceRoster={sourceRoster ?? []}
          group={g}
          candidates={candidatesByGroup(g.key)}
          sides={sides}
          userId={userId}
          closed={closed}
          onAccept={(cid, side) => decideMutation.mutate({ cid, side, decision: "ACCEPTED" })}
          onReject={(cid, side) => decideMutation.mutate({ cid, side, decision: "REJECTED" })}
          onAdd={(employeeId, side) => addMutation.mutate({ employeeId, side })}
          onRemove={(cid) => removeMutation.mutate(cid)}
          pending={decideMutation.isPending || addMutation.isPending || removeMutation.isPending}
        />
      ))}
    </div>
  );
}

function RoleSection({
  request, sourceRoster, group, candidates, sides, userId, closed,
  onAccept, onReject, onAdd, onRemove, pending
}: {
  request: RequestDetail;
  sourceRoster: Employee[];
  group: { key: RoleKey; label: string; positions: string[]; need: keyof RequestDetail };
  candidates: Candidate[];
  sides: { isAdmin: boolean; canActAsRequester: boolean; canActAsSource: boolean };
  userId: string | undefined;
  closed: boolean;
  onAccept: (cid: string, side: CandSide) => void;
  onReject: (cid: string, side: CandSide) => void;
  onAdd: (employeeId: string, side: CandSide) => void;
  onRemove: (cid: string) => void;
  pending: boolean;
}) {
  const need = request[group.need] as number;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const proposedIds = new Set(candidates.map((c) => c.employee.id));
  const searchTokens = parseSearchTokens(search);
  const multiTokenMode = searchTokens.length > 1;
  const pool = sourceRoster
    .filter((e) => group.positions.includes(e.position) && !proposedIds.has(e.id))
    .filter((e) => matchEmployee(e, searchTokens));

  const canAddAsRequester = sides.canActAsRequester && !closed;
  const canAddAsSource = sides.canActAsSource && !closed;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">{group.label}</CardTitle>
          <CardDescription>Need {need} · {candidates.length} candidate{candidates.length === 1 ? "" : "s"}</CardDescription>
        </div>
        {(canAddAsRequester || canAddAsSource) && need > 0 && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add candidate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add {group.label.toLowerCase()} candidate</DialogTitle>
                <DialogDescription>
                  Pick from {request.sourceProject.name}&apos;s roster.                   {canAddAsRequester && canAddAsSource ? "You can act on either side." : canAddAsRequester ? "You will add this on the requester side (awaits source approval)." : "You will add this on the source side (awaits requester approval)."}
                </DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email — paste a list to filter many..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (!/[\r\n]/.test(text)) return;
                    e.preventDefault();
                    const normalized = flattenPastedList(text);
                    const target = e.currentTarget;
                    const start = target.selectionStart ?? search.length;
                    const end = target.selectionEnd ?? search.length;
                    setSearch(search.slice(0, start) + normalized + search.slice(end));
                  }}
                  className="pl-9 pr-24"
                />
                {multiTokenMode && (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-2xs font-medium tabular text-accent">
                    {searchTokens.length} tokens
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border scrollbar-thin">
                {pool.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No more eligible {group.label.toLowerCase()} in source project.</div>
                ) : pool.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{e.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{e.email}</div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {canAddAsRequester && (
                        <Button size="sm" variant="default" onClick={() => { onAdd(e.id, "REQUESTER"); setOpen(false); }} disabled={pending}>
                          Request
                        </Button>
                      )}
                      {canAddAsSource && (
                        <Button size="sm" variant="secondary" onClick={() => { onAdd(e.id, "SOURCE"); setOpen(false); }} disabled={pending}>
                          Offer
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No candidates yet for this role.</p>
        ) : candidates.map((c) => (
          <CandidateRow
            key={c.id}
            c={c}
            sides={sides}
            closed={closed}
            userId={userId}
            onAccept={onAccept}
            onReject={onReject}
            onRemove={onRemove}
            pending={pending}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function CandidateRow({
  c, sides, closed, userId, onAccept, onReject, onRemove, pending
}: {
  c: Candidate;
  sides: { isAdmin: boolean; canActAsRequester: boolean; canActAsSource: boolean };
  closed: boolean;
  userId: string | undefined;
  onAccept: (cid: string, side: CandSide) => void;
  onReject: (cid: string, side: CandSide) => void;
  onRemove: (cid: string) => void;
  pending: boolean;
}) {
  const finalized = c.requesterDecision === "ACCEPTED" && c.sourceDecision === "ACCEPTED";
  const canRequesterAct = !closed && sides.canActAsRequester && c.proposedBy === "SOURCE" && c.requesterDecision === "PENDING";
  const canSourceAct = !closed && sides.canActAsSource && c.proposedBy === "REQUESTER" && c.sourceDecision === "PENDING";
  const canRemove = !closed && (sides.isAdmin || c.proposer.id === userId);

  return (
    <div className={`rounded-md border p-3 ${finalized ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{c.employee.name}</span>
            <span className="text-xs text-muted-foreground">{c.employee.email}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Proposed by <span className="font-medium">{c.proposedBy === "REQUESTER" ? "Requester" : "Source"}</span> ({c.proposer.name ?? c.proposer.email})
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <DecisionBadge label="Req" decision={c.requesterDecision} />
          <DecisionBadge label="Src" decision={c.sourceDecision} />
        </div>
      </div>

      {(canRequesterAct || canSourceAct || canRemove) && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          {canRequesterAct && (
            <>
              <Button size="sm" variant="default" disabled={pending} onClick={() => onAccept(c.id, "REQUESTER")}>
                <Check className="mr-1 h-3.5 w-3.5" /> Accept (requester)
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => onReject(c.id, "REQUESTER")}>
                <X className="mr-1 h-3.5 w-3.5" /> Reject (requester)
              </Button>
            </>
          )}
          {canSourceAct && (
            <>
              <Button size="sm" variant="default" disabled={pending} onClick={() => onAccept(c.id, "SOURCE")}>
                <Check className="mr-1 h-3.5 w-3.5" /> Accept (source)
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => onReject(c.id, "SOURCE")}>
                <X className="mr-1 h-3.5 w-3.5" /> Reject (source)
              </Button>
            </>
          )}
          {canRemove && (
            <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => onRemove(c.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionBadge({ label, decision }: { label: string; decision: CandDecisionEnum }) {
  const variant = decision === "ACCEPTED" ? "success" : decision === "REJECTED" ? "destructive" : "outline";
  return (
    <Badge variant={variant} className="gap-1">
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span>{titleCase(decision)}</span>
    </Badge>
  );
}
