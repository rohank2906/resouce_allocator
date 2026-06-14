"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Pencil, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/lib/toast";

const PROJECT_TYPES = [
  "Production",
  "Research",
  "Stage 1",
  "Stage 2",
  "Engineering",
  "Operations",
  "Other"
] as const;

const PROJECT_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  type: z.string().trim().max(60).optional(),
  status: z.enum(PROJECT_STATUSES),
  description: z.string().trim().max(500).optional()
});

type FormValues = z.infer<typeof schema>;

export interface EditableProject {
  id: string;
  name: string;
  type?: string | null;
  status?: string | null;
  description?: string | null;
}

interface EditProjectDialogProps {
  project: EditableProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({ project, open, onOpenChange }: EditProjectDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: "ACTIVE" }
  });

  const status = watch("status");
  const type = watch("type");

  useEffect(() => {
    if (project && open) {
      reset({
        name: project.name,
        type: project.type ?? undefined,
        status: (project.status as (typeof PROJECT_STATUSES)[number]) ?? "ACTIVE",
        description: project.description ?? ""
      });
      setServerError(null);
    }
  }, [project, open, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!project) throw new Error("No project selected");
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to update project");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Project updated");
      setServerError(null);
      onOpenChange(false);
    },
    onError: (err: Error) => setServerError(err.message)
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(217_91%_60%)] to-[hsl(243_85%_64%)] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)]">
            <Pencil className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update project details. Renaming triggers a uniqueness check.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-project-name" className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Project name
            </Label>
            <Input id="edit-project-name" autoFocus {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Type
              </Label>
              <Select
                value={type ?? ""}
                onValueChange={(v) => setValue("type", v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Status
              </Label>
              <Select
                value={status}
                onValueChange={(v) => setValue("status", v as (typeof PROJECT_STATUSES)[number])}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-project-description" className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Description
            </Label>
            <Textarea id="edit-project-description" rows={3} {...register("description")} />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <AnimatePresence initial={false}>
            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 rounded-md border border-[hsl(0_75%_55%/0.35)] bg-[hsl(0_75%_55%/0.08)] px-3 py-2 text-xs text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_75%)]"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{serverError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
