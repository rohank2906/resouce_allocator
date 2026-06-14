"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, Trash2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/lib/toast";

export interface DeletableProject {
  id: string;
  name: string;
  employeeCount: number;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface DeleteProjectDialogProps {
  project: DeletableProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectAfterDelete?: string;
}

type Mode = "transfer" | "offboard";

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  redirectAfterDelete
}: DeleteProjectDialogProps) {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("transfer");
  const [transferTo, setTransferTo] = useState<string>("");

  useEffect(() => {
    if (open) {
      setServerError(null);
      setMode("transfer");
      setTransferTo("");
    }
  }, [open, project?.id]);

  const { data: projects } = useQuery<ProjectOption[]>({
    queryKey: ["projects-options"],
    queryFn: () =>
      fetch("/api/projects")
        .then((r) => r.json())
        .then((rows: Array<{ id: string; name: string }>) =>
          rows.map((p) => ({ id: p.id, name: p.name }))
        ),
    enabled: open
  });

  const otherProjects = useMemo(
    () => (projects ?? []).filter((p) => p.id !== project?.id),
    [projects, project?.id]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("No project selected");
      const params = new URLSearchParams();
      if (project.employeeCount > 0) {
        if (mode === "transfer") {
          if (!transferTo) throw new Error("Choose a destination project");
          params.set("transferTo", transferTo);
        } else {
          params.set("offboard", "true");
        }
      }
      const url = `/api/projects/${project.id}${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to delete project");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects-options"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(`${project?.name ?? "Project"} deleted`);
      onOpenChange(false);
      if (redirectAfterDelete) router.push(redirectAfterDelete);
    },
    onError: (err: Error) => setServerError(err.message)
  });

  const hasEmployees = (project?.employeeCount ?? 0) > 0;
  const canSubmit =
    !!project &&
    !mutation.isPending &&
    (!hasEmployees ||
      (mode === "transfer" ? Boolean(transferTo) : true));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(0_75%_55%/0.12)] text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)] border border-[hsl(0_75%_55%/0.3)]">
            <Trash2 className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <DialogTitle>Delete {project?.name ?? "project"}?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Project history is preserved in the audit log.
          </DialogDescription>
        </DialogHeader>

        {hasEmployees && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-lg border border-[hsl(35_95%_50%/0.35)] bg-[hsl(35_95%_50%/0.08)] px-3 py-2.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px text-[hsl(28_85%_42%)] dark:text-[hsl(38_92%_72%)]" />
              <div className="text-[hsl(28_85%_35%)] dark:text-[hsl(38_92%_75%)]">
                <p className="font-medium">
                  {project?.employeeCount} {project?.employeeCount === 1 ? "employee is" : "employees are"} still assigned.
                </p>
                <p className="mt-0.5 opacity-80">
                  Pick what should happen to them before the project is deleted.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Disposition
              </Label>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setMode("transfer")}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    mode === "transfer"
                      ? "border-accent/50 bg-accent/[0.06]"
                      : "border-border-subtle hover:bg-muted/40"
                  }`}
                >
                  <Users className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Transfer to another project</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Move all {project?.employeeCount} into a chosen project before delete.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("offboard")}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    mode === "offboard"
                      ? "border-[hsl(0_75%_55%/0.6)] bg-[hsl(0_75%_55%/0.06)]"
                      : "border-border-subtle hover:bg-muted/40"
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)]" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Offboard all employees</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Remove from active rosters. Audit history is retained.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {mode === "transfer" && (
              <div className="space-y-1.5">
                <Label className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Destination project
                </Label>
                <Select value={transferTo} onValueChange={setTransferTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose project" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {otherProjects.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No other projects available. Create another first or pick Offboard.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-md border border-[hsl(0_75%_55%/0.35)] bg-[hsl(0_75%_55%/0.08)] px-3 py-2 text-xs text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_75%)]"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{serverError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Deleting
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" /> Delete project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
