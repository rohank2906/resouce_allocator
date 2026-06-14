"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, UserPlus, AlertCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/lib/toast";
import { titleCase } from "@/lib/utils";

const ETHARA_EMAIL = /^[a-z0-9._-]+@ethara\.ai$/i;

const POSITION_OPTIONS = [
  "TPM",
  "PL",
  "QUALITY_LEAD",
  "TASKER",
  "INTERN_TASKER",
  "ENGINEERING_SUPPORT",
  "RESEARCH_SUPPORT"
] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(ETHARA_EMAIL, "Email must end with @ethara.ai"),
  projectId: z.string().min(1, "Select a project"),
  position: z.enum(POSITION_OPTIONS, { required_error: "Select a position" })
});

type FormValues = z.infer<typeof schema>;

interface ProjectOption {
  id: string;
  name: string;
}

interface CreateEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateEmployeeDialog({ open, onOpenChange, onCreated }: CreateEmployeeDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: projects } = useQuery<ProjectOption[]>({
    queryKey: ["projects-options"],
    queryFn: () =>
      fetch("/api/projects")
        .then((r) => r.json())
        .then((rows: { id: string; name: string }[]) =>
          rows.map((p) => ({ id: p.id, name: p.name }))
        ),
    enabled: open
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const projectId = watch("projectId");
  const position = watch("position");

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to create employee");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Employee added");
      reset();
      setServerError(null);
      onCreated?.();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setServerError(err.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(217_91%_60%)] to-[hsl(243_85%_64%)] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)]">
            <UserPlus className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Creates the user with a default password of <span className="font-numeric text-foreground">firstName@123</span>.
            They will be prompted to change it after first sign in.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="employee-name" className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Full name
            </Label>
            <Input id="employee-name" placeholder="Vyom Sahu" autoFocus {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="employee-email" className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Work email
            </Label>
            <Input
              id="employee-email"
              type="email"
              placeholder="vyom.sahu@ethara.ai"
              {...register("email")}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Project
              </Label>
              <Select
                value={projectId ?? ""}
                onValueChange={(v) => setValue("projectId", v, { shouldValidate: true })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={projects ? "Select project" : "Loading..."} />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.projectId && <p className="text-xs text-destructive">{errors.projectId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Position
              </Label>
              <Select
                value={position ?? ""}
                onValueChange={(v) => setValue("position", v as (typeof POSITION_OPTIONS)[number], { shouldValidate: true })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {titleCase(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.position && <p className="text-xs text-destructive">{errors.position.message}</p>}
            </div>
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
              onClick={() => {
                reset();
                setServerError(null);
                onOpenChange(false);
              }}
              disabled={isSubmitting || mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Adding
                </>
              ) : (
                "Add employee"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
