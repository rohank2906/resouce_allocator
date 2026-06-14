"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Search,
  ArrowRightLeft,
  Pencil,
  ChevronLeft,
  ChevronRight,
  X,
  MoreHorizontal,
  UserMinus,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { cn, titleCase } from "@/lib/utils";
import { useToast } from "@/lib/toast";
import { FadeUp } from "@/components/motion/primitives";
import { AnimatePresence, motion } from "framer-motion";
import { EditEmployeeDialog, type EditableEmployee } from "@/components/employees/edit-employee-dialog";
import { OffboardEmployeeDialog, type OffboardableEmployee } from "@/components/employees/offboard-employee-dialog";
import { can } from "@/lib/rbac/permissions";
import { parseSearchTokens, matchEmployee, flattenPastedList } from "@/lib/employee-search";
import type { Role } from "@prisma/client";

interface Project {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  position: string;
  project: Project;
  attendanceStatus: "PRESENT" | "LEAVE" | "ABSENT" | "UNKNOWN" | null;
  attendanceDate: string | null;
  lastSyncedAt: string | null;
}

const ATTENDANCE_VARIANTS: Record<string, "success" | "warning" | "destructive" | "outline"> = {
  PRESENT: "success",
  LEAVE: "warning",
  ABSENT: "destructive",
  UNKNOWN: "outline"
};

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: "Present",
  LEAVE: "Leave",
  ABSENT: "Absent",
  UNKNOWN: "Unknown"
};

const ATTENDANCE_FILTER_VALUES = ["PRESENT", "LEAVE", "ABSENT", "UNKNOWN", "UNSYNCED"];

const POSITION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "accent"> = {
  PL: "success",
  QUALITY_LEAD: "info",
  TPM: "warning",
  TASKER: "secondary",
  INTERN_TASKER: "outline",
  ENGINEERING_SUPPORT: "default",
  RESEARCH_SUPPORT: "accent"
};

const POSITIONS = ["PL", "QUALITY_LEAD", "TPM", "TASKER", "INTERN_TASKER", "ENGINEERING_SUPPORT", "RESEARCH_SUPPORT"];

const PAGE_SIZE = 50;

function AttendancePill({ status }: { status: Employee["attendanceStatus"] }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground/60 tabular">
        Not synced
      </span>
    );
  }
  return (
    <Badge variant={ATTENDANCE_VARIANTS[status] ?? "outline"} dot>
      {ATTENDANCE_LABEL[status] ?? status}
    </Badge>
  );
}

export default function EmployeesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = can(role, "manageEmployees");

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [attendanceFilter, setAttendanceFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<string>("");
  const [bulkOffboardOpen, setBulkOffboardOpen] = useState(false);
  const [bulkOffboardConfirmed, setBulkOffboardConfirmed] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editTarget, setEditTarget] = useState<string>("");
  const [editingDetails, setEditingDetails] = useState<EditableEmployee | null>(null);
  const [offboarding, setOffboarding] = useState<OffboardableEmployee | null>(null);

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json())
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json())
  });

  const searchTokens = useMemo(() => parseSearchTokens(search), [search]);
  const multiTokenMode = searchTokens.length > 1;

  const filtered = useMemo(() => {
    if (!employees) return [];
    return employees.filter((e) => {
      if (projectFilter !== "ALL" && e.project?.id !== projectFilter) return false;
      if (positionFilter !== "ALL" && e.position !== positionFilter) return false;
      if (attendanceFilter !== "ALL") {
        if (attendanceFilter === "UNSYNCED") {
          if (e.attendanceStatus !== null) return false;
        } else if (e.attendanceStatus !== attendanceFilter) {
          return false;
        }
      }
      if (!matchEmployee(e, searchTokens)) return false;
      return true;
    });
  }, [employees, searchTokens, projectFilter, positionFilter, attendanceFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const allOnPageSelected = paged.length > 0 && paged.every((e) => selected.has(e.id));
  const someOnPageSelected = paged.some((e) => selected.has(e.id));

  function togglePageSelection(check: boolean) {
    const next = new Set(selected);
    if (check) paged.forEach((e) => next.add(e.id));
    else paged.forEach((e) => next.delete(e.id));
    setSelected(next);
  }

  function toggleOne(id: string, check: boolean) {
    const next = new Set(selected);
    if (check) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const moveMutation = useMutation({
    mutationFn: async ({ ids, projectId }: { ids: string[]; projectId: string }) => {
      const res = await fetch("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, projectId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const projectName = projects?.find((p) => p.id === bulkTarget || p.id === editTarget)?.name ?? "project";
      toast.success(`Moved ${data.updated} employee${data.updated === 1 ? "" : "s"} to ${projectName}`);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      clearSelection();
      setBulkOpen(false);
      setEditing(null);
      setBulkTarget("");
      setEditTarget("");
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const bulkOffboardMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/employees/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "offboard", ids })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }
      return res.json();
    },
    onSuccess: (data: { removed: number }) => {
      toast.success(`Offboarded ${data.removed} employee${data.removed === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      clearSelection();
      setBulkOffboardOpen(false);
      setBulkOffboardConfirmed(false);
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function buildRowActionMenu(emp: Employee) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${emp.name}`}
            className="min-tap shrink-0"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={() => {
              setEditing(emp);
              setEditTarget(emp.project?.id ?? "");
            }}
          >
            <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
            Reassign project
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              setEditingDetails({
                id: emp.id,
                name: emp.name,
                email: emp.email,
                position: emp.position,
                project: emp.project
              })
            }
          >
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-[hsl(0_72%_50%)] focus:text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)]"
            onSelect={() =>
              setOffboarding({
                id: emp.id,
                name: emp.name,
                email: emp.email,
                position: emp.position,
                project: emp.project
              })
            }
          >
            <UserMinus className="h-3.5 w-3.5 mr-2" />
            Offboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-8">
      <FadeUp>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Employees</h1>
            <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
              Manage workforce assignments across all projects.
            </p>
          </div>
          <div className="text-sm tabular text-muted-foreground shrink-0">
            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <>
                <span className="font-numeric font-medium text-foreground">
                  {filtered.length.toLocaleString()}
                </span>
                {employees && filtered.length !== employees.length && (
                  <>
                    {" "}of <span className="font-numeric text-foreground">
                      {employees.length.toLocaleString()}
                    </span>
                  </>
                )}{" "}
                matching
              </>
            )}
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.05}>
        <Card flat className="overflow-hidden">
          <CardHeader className="border-b border-border-subtle p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,auto,auto] gap-2 sm:gap-3 sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email — paste a list to filter many..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (!/[\r\n]/.test(text)) return;
                    e.preventDefault();
                    const normalized = flattenPastedList(text);
                    const target = e.currentTarget;
                    const start = target.selectionStart ?? search.length;
                    const end = target.selectionEnd ?? search.length;
                    setSearch(search.slice(0, start) + normalized + search.slice(end));
                    setPage(1);
                  }}
                  className="pl-9 w-full"
                />
                {multiTokenMode && (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-2xs font-medium tabular text-accent">
                    {searchTokens.length} tokens
                  </span>
                )}
              </div>
              <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="All projects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All projects</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={positionFilter} onValueChange={(v) => { setPositionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[170px]"><SelectValue placeholder="All roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={attendanceFilter} onValueChange={(v) => { setAttendanceFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Attendance" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All attendance</SelectItem>
                  {ATTENDANCE_FILTER_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v === "UNSYNCED" ? "Not yet synced" : ATTENDANCE_LABEL[v] ?? titleCase(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 border-b border-accent/20 bg-gradient-to-r from-accent/[0.06] to-accent/[0.02] px-6 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="accent" dot>
                      <span className="tabular">{selected.size}</span> selected
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      <X className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkOffboardOpen(true)}
                        className="text-[hsl(0_72%_50%)] hover:text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)]"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Offboard
                      </Button>
                    )}
                    {canManage && (
                      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                        <DialogTrigger asChild>
                          <Button variant="accent" size="sm">
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            Move to project
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              Move {selected.size} employee{selected.size === 1 ? "" : "s"}
                            </DialogTitle>
                            <DialogDescription>
                              Choose the destination project. This action is audit-logged.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-2 py-2">
                            <Select value={bulkTarget} onValueChange={setBulkTarget}>
                              <SelectTrigger><SelectValue placeholder="Select destination project" /></SelectTrigger>
                              <SelectContent>
                                {projects?.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter>
                            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Cancel</Button>
                            <Button
                              variant="accent"
                              disabled={!bulkTarget || moveMutation.isPending}
                              onClick={() => moveMutation.mutate({ ids: Array.from(selected), projectId: bulkTarget })}
                            >
                              {moveMutation.isPending ? "Moving..." : "Confirm move"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4 sm:p-6">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : paged.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground px-4 text-center">
                No employees match your filters.
              </div>
            ) : (
              <>
                <div className="md:hidden divide-y divide-border-subtle">
                  {paged.map((emp) => {
                    const isSelected = selected.has(emp.id);
                    return (
                      <div
                        key={emp.id}
                        className={cn(
                          "flex items-start gap-3 p-4 transition-colors",
                          isSelected ? "bg-accent/[0.06]" : ""
                        )}
                      >
                        {canManage && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(c) => toggleOne(emp.id, c === true)}
                            aria-label={`Select ${emp.name}`}
                            className="mt-1 shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground truncate leading-tight">
                              {emp.name}
                            </p>
                            {canManage && (
                              <div className="-mt-1.5 -mr-1.5">
                                {buildRowActionMenu(emp)}
                              </div>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">{emp.email}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant={POSITION_VARIANTS[emp.position] ?? "default"}>
                              {titleCase(emp.position)}
                            </Badge>
                            <AttendancePill status={emp.attendanceStatus} />
                            <span className="text-xs text-foreground/80 truncate">
                              {emp.project?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canManage && (
                          <TableHead className="w-10 pl-4">
                            <Checkbox
                              checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                              onCheckedChange={(c) => togglePageSelection(c === true)}
                              aria-label="Select page"
                            />
                          </TableHead>
                        )}
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden lg:table-cell">Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead className="hidden md:table-cell">Attendance</TableHead>
                        <TableHead className="hidden xl:table-cell">Last Updated</TableHead>
                        <TableHead className="w-10 text-right pr-4"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((emp) => (
                        <TableRow key={emp.id} data-state={selected.has(emp.id) ? "selected" : undefined}>
                          {canManage && (
                            <TableCell className="pl-4">
                              <Checkbox
                                checked={selected.has(emp.id)}
                                onCheckedChange={(c) => toggleOne(emp.id, c === true)}
                                aria-label={`Select ${emp.name}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium text-foreground">{emp.name}</TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">{emp.email}</TableCell>
                          <TableCell>
                            <Badge variant={POSITION_VARIANTS[emp.position] ?? "default"}>
                              {titleCase(emp.position)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-foreground/90">{emp.project?.name}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <AttendancePill status={emp.attendanceStatus} />
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-xs text-muted-foreground tabular">
                            {emp.lastSyncedAt
                              ? format(new Date(emp.lastSyncedAt), "MMM d, HH:mm")
                              : <span className="opacity-50">—</span>}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            {canManage ? buildRowActionMenu(emp) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border-subtle bg-muted/20 px-4 sm:px-6 py-3">
            <div className="text-xs tabular text-muted-foreground order-2 sm:order-1">
              {paged.length > 0 ? (
                <>
                  Page <span className="font-medium text-foreground">{currentPage}</span> of {pageCount}
                  <span className="mx-1 opacity-40 hidden sm:inline">·</span>
                  <span className="hidden sm:inline">
                    {" "}{(currentPage - 1) * PAGE_SIZE + 1}–{(currentPage - 1) * PAGE_SIZE + paged.length} of{" "}
                    <span className="font-medium text-foreground">{filtered.length}</span>
                  </span>
                </>
              ) : "—"}
            </div>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className="flex-1 sm:flex-none"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
                className="flex-1 sm:flex-none"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </FadeUp>

      <EditEmployeeDialog
        employee={editingDetails}
        open={!!editingDetails}
        onOpenChange={(open) => !open && setEditingDetails(null)}
      />

      <OffboardEmployeeDialog
        employee={offboarding}
        open={!!offboarding}
        onOpenChange={(open) => !open && setOffboarding(null)}
      />

      <Dialog
        open={bulkOffboardOpen}
        onOpenChange={(open) => {
          setBulkOffboardOpen(open);
          if (!open) setBulkOffboardConfirmed(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offboard {selected.size} employee{selected.size === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              Removes selected employees from active rosters, dashboards, and staffing counts. Audit history is preserved.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2.5 rounded-lg border border-[hsl(35_95%_50%/0.35)] bg-[hsl(35_95%_50%/0.08)] px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={bulkOffboardConfirmed}
              onChange={(e) => setBulkOffboardConfirmed(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[hsl(0_72%_50%)]"
            />
            <span className="text-xs text-[hsl(28_85%_35%)] dark:text-[hsl(38_92%_75%)] leading-snug">
              <AlertTriangle className="h-3 w-3 inline-block -mt-0.5 mr-1" />
              I understand this will remove {selected.size} employee{selected.size === 1 ? "" : "s"} from active staffing counts and dashboards.
            </span>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOffboardOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!bulkOffboardConfirmed || bulkOffboardMutation.isPending}
              onClick={() => bulkOffboardMutation.mutate(Array.from(selected))}
            >
              {bulkOffboardMutation.isPending ? "Offboarding..." : "Confirm offboard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setEditTarget(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign {editing?.name}</DialogTitle>
            <DialogDescription>
              Currently on <span className="font-medium text-foreground">{editing?.project?.name}</span> as{" "}
              <span className="font-medium text-foreground">{editing && titleCase(editing.position)}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Select value={editTarget} onValueChange={setEditTarget}>
              <SelectTrigger><SelectValue placeholder="Select destination project" /></SelectTrigger>
              <SelectContent>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={p.id === editing?.project?.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditing(null); setEditTarget(""); }}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!editTarget || editTarget === editing?.project?.id || moveMutation.isPending}
              onClick={() => editing && moveMutation.mutate({ ids: [editing.id], projectId: editTarget })}
            >
              {moveMutation.isPending ? "Saving..." : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
