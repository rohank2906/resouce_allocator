"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, UserMinus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/toast";
import { titleCase } from "@/lib/utils";

export interface OffboardableEmployee {
  id: string;
  name: string;
  email: string;
  position: string;
  project?: { id: string; name: string };
}

interface OffboardEmployeeDialogProps {
  employee: OffboardableEmployee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OffboardEmployeeDialog({
  employee,
  open,
  onOpenChange
}: OffboardEmployeeDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setServerError(null);
    }
  }, [open, employee?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!employee) throw new Error("No employee selected");
      const res = await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to offboard");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`${employee?.name ?? "Employee"} offboarded`);
      onOpenChange(false);
    },
    onError: (err: Error) => setServerError(err.message)
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(0_75%_55%/0.12)] text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)] border border-[hsl(0_75%_55%/0.3)]">
            <UserMinus className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <DialogTitle>Offboard employee?</DialogTitle>
          <DialogDescription>
            Removes the employee from active rosters and dashboards. Audit history is preserved.
          </DialogDescription>
        </DialogHeader>

        {employee && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border-subtle bg-muted/30 px-3.5 py-3 space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-foreground truncate">{employee.name}</p>
                <span className="text-2xs uppercase tracking-wider text-muted-foreground shrink-0">
                  {titleCase(employee.position)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-numeric truncate">{employee.email}</p>
              {employee.project && (
                <p className="text-xs text-muted-foreground">
                  on <span className="text-foreground/90 font-medium">{employee.project.name}</span>
                </p>
              )}
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-[hsl(35_95%_50%/0.35)] bg-[hsl(35_95%_50%/0.08)] px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[hsl(0_72%_50%)]"
              />
              <span className="text-xs text-[hsl(28_85%_35%)] dark:text-[hsl(38_92%_75%)] leading-snug">
                <AlertTriangle className="h-3 w-3 inline-block -mt-0.5 mr-1" />
                I understand this removes the employee from active staffing counts, dashboards, and rosters. The audit log is retained.
              </span>
            </label>
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
            disabled={!confirmed || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Offboarding
              </>
            ) : (
              <>
                <UserMinus className="h-4 w-4" /> Offboard
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
