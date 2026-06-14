"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, Search, X, Plus, Sparkles, Users, FileText, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { requestCreateSchema } from "@/lib/services/schemas";
import { useToast } from "@/lib/toast";
import { titleCase } from "@/lib/utils";
import { parseSearchTokens, matchEmployee, flattenPastedList } from "@/lib/employee-search";
import { FadeUp, StaggerGroup, StaggerItem } from "@/components/motion/primitives";

type FormData = z.infer<typeof requestCreateSchema>;

interface Project { id: string; name: string }
interface Employee { id: string; name: string; email: string; position: string }

const CANDIDATE_POSITIONS = new Set(["PL", "QUALITY_LEAD", "TASKER", "INTERN_TASKER"]);

export default function NewRequestPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const [picked, setPicked] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json())
  });

  const {
    register, handleSubmit, formState: { errors }, setValue, watch
  } = useForm<FormData>({
    resolver: zodResolver(requestCreateSchema),
    defaultValues: {
      plNeeded: 0,
      qualityLeadsNeeded: 0,
      taskersNeeded: 0,
      requestedEmployeeIds: []
    }
  });

  const sourceProjectId = watch("sourceProjectId");
  const plNeeded = watch("plNeeded") ?? 0;
  const qlNeeded = watch("qualityLeadsNeeded") ?? 0;
  const tNeeded = watch("taskersNeeded") ?? 0;
  const totalNeeded = Number(plNeeded) + Number(qlNeeded) + Number(tNeeded);

  const { data: sourceEmployees } = useQuery<Employee[]>({
    queryKey: ["employees", "by-project", sourceProjectId],
    queryFn: () =>
      fetch(`/api/employees?projectId=${sourceProjectId}`).then((r) => r.json()),
    enabled: !!sourceProjectId
  });

  useEffect(() => { setPicked([]); }, [sourceProjectId]);

  useEffect(() => {
    setValue("requestedEmployeeIds", picked.map((e) => e.id));
  }, [picked, setValue]);

  const eligible = useMemo(() => {
    if (!sourceEmployees) return [];
    return sourceEmployees.filter((e) => CANDIDATE_POSITIONS.has(e.position));
  }, [sourceEmployees]);

  const searchTokens = useMemo(() => parseSearchTokens(search), [search]);
  const multiTokenMode = searchTokens.length > 1;

  const filtered = useMemo(() => {
    const base = eligible.filter((e) => !picked.some((p) => p.id === e.id));
    return base.filter((e) => matchEmployee(e, searchTokens));
  }, [eligible, searchTokens, picked]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.formErrors?.join(", ") || err.error?.message || err.error || "Failed");
        }
        return res.json();
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Request created");
      router.push(`/requests/${result.id}`);
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const requestingProjectId = watch("requestingProjectId");
  const sameProject = requestingProjectId && sourceProjectId && requestingProjectId === sourceProjectId;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <FadeUp>
        <div>
          <Link
            href="/requests"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            All requests
          </Link>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" /> New Request
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Request resources
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
            Submit a transfer request to draw employees from another project. The source PL reviews and approves.
          </p>
        </div>
      </FadeUp>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        <FadeUp delay={0.05}>
          <Card>
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-muted/60 text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Overview</CardTitle>
                <CardDescription className="mt-1">
                  Counts can be split across PL, Quality Lead, and Tasker roles.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field
                id="title"
                label="Title"
                error={errors.title?.message}
              >
                <Input id="title" {...register("title")} placeholder="e.g., Need taskers for Q2 sprint" />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Requesting project" error={errors.requestingProjectId?.message}>
                  <Select onValueChange={(v) => setValue("requestingProjectId", v)}>
                    <SelectTrigger><SelectValue placeholder="Your project" /></SelectTrigger>
                    <SelectContent>
                      {projects?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Source project" error={errors.sourceProjectId?.message}>
                  <Select onValueChange={(v) => setValue("sourceProjectId", v)}>
                    <SelectTrigger><SelectValue placeholder="Project to draw from" /></SelectTrigger>
                    <SelectContent>
                      {projects?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {sameProject && (
                <div className="flex items-center gap-2 rounded-md border border-[hsl(35_95%_50%/0.3)] bg-[hsl(35_95%_50%/0.08)] px-3 py-2 text-xs text-[hsl(28_85%_35%)] dark:text-[hsl(38_92%_72%)]">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Requesting and source must be different projects.</span>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Headcount needed
                </Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <CountField
                    id="plNeeded"
                    label="Project Leads"
                    register={register("plNeeded")}
                    error={errors.plNeeded?.message}
                  />
                  <CountField
                    id="qualityLeadsNeeded"
                    label="Quality Leads"
                    register={register("qualityLeadsNeeded")}
                    error={errors.qualityLeadsNeeded?.message}
                  />
                  <CountField
                    id="taskersNeeded"
                    label="Taskers"
                    register={register("taskersNeeded")}
                    error={errors.taskersNeeded?.message}
                  />
                </div>
                {totalNeeded > 0 && (
                  <p className="pt-1 text-xs text-muted-foreground tabular">
                    Total: <span className="font-numeric font-semibold text-foreground">{totalNeeded}</span> {totalNeeded === 1 ? "person" : "people"}
                  </p>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Priority" error={errors.priority?.message}>
                  <Select onValueChange={(v) => setValue("priority", v as FormData["priority"])}>
                    <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="requiredBy" label="Required by" error={errors.requiredBy?.message}>
                  <Input id="requiredBy" type="date" {...register("requiredBy")} />
                </Field>
              </div>

              <Field
                id="justification"
                label="Justification"
                error={errors.justification?.message}
              >
                <Textarea
                  id="justification"
                  {...register("justification")}
                  rows={4}
                  placeholder="Why are these resources needed? Include sprint/scope context."
                />
              </Field>
            </CardContent>
          </Card>
        </FadeUp>

        <FadeUp delay={0.1}>
          <Card>
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-muted/60 text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Request specific people <span className="text-muted-foreground font-normal">(optional)</span></CardTitle>
                <CardDescription className="mt-1">
                  {sourceProjectId
                    ? "Pick named candidates. The source PL reviews each, then proposes others for unfilled slots."
                    : "Pick a source project first to browse its roster."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {picked.length > 0 && (
                <StaggerGroup className="flex flex-wrap gap-2" stagger={0.02}>
                  {picked.map((p) => (
                    <StaggerItem key={p.id}>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 py-1 pl-2 pr-1 text-xs text-accent">
                        <span className="font-medium">{p.name}</span>
                        <span className="opacity-70">·</span>
                        <span className="text-2xs opacity-80">{titleCase(p.position)}</span>
                        <button
                          type="button"
                          onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-accent/20 transition-colors duration-100"
                          aria-label={`Remove ${p.email}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    </StaggerItem>
                  ))}
                </StaggerGroup>
              )}

              {sourceProjectId && (
                <>
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
                  {multiTokenMode && filtered.length > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-accent/25 bg-accent/[0.05] px-3 py-2 text-xs">
                      <span className="text-foreground/80">
                        <span className="font-numeric font-semibold text-foreground">{filtered.length}</span> of{" "}
                        <span className="font-numeric tabular">{searchTokens.length}</span> tokens matched eligible candidates.
                      </span>
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        onClick={() => { setPicked([...picked, ...filtered]); setSearch(""); }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add all {filtered.length}
                      </Button>
                    </div>
                  )}
                  <div className="max-h-72 overflow-y-auto rounded-md border border-border-subtle scrollbar-thin">
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                          <Users className="h-4 w-4" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {search ? "No matches in this project's roster." : "No eligible candidates in this project."}
                        </p>
                      </div>
                    ) : (
                      filtered.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => { setPicked([...picked, e]); setSearch(""); }}
                          className="group flex w-full items-center justify-between gap-3 border-b border-border-subtle px-3 py-2.5 text-left last:border-0 transition-colors duration-150 hover:bg-muted/40"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">{e.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{e.email}</div>
                          </div>
                          <Badge variant="outline" className="shrink-0">{titleCase(e.position)}</Badge>
                          <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all duration-150 group-hover:text-accent group-hover:scale-110" />
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </FadeUp>

        <FadeUp delay={0.15}>
          <div className="flex items-center justify-end gap-3 rounded-xl border border-border-subtle bg-muted/30 px-4 py-3">
            <Button variant="ghost" asChild>
              <Link href="/requests">Cancel</Link>
            </Button>
            <Button type="submit" variant="accent" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Submitting
                </>
              ) : (
                <>Submit request</>
              )}
            </Button>
          </div>
        </FadeUp>
      </form>
    </div>
  );
}

function Field({
  id, label, error, children
}: {
  id?: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CountField({
  id, label, register, error
}: {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-2xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        defaultValue={0}
        className="font-numeric"
        {...register}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
