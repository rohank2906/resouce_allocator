"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import type { Position, Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/lib/toast";
import { initials, titleCase } from "@/lib/utils";
import { StaggerGroup, StaggerItem } from "@/components/motion/primitives";
import {
  derivePasswordStatus,
  passwordStatusLabel,
  type PasswordStatus
} from "@/lib/services/password-status";

interface AppUser {
  id: string;
  name?: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  passwordResetAt: string | null;
  lastLogin: string | null;
  createdAt: string;
  employee: {
    position: Position;
    project: { name: string } | null;
  } | null;
  passwordStatus?: PasswordStatus;
}

const ROLE_TONE: Record<Role, "destructive" | "warning" | "success" | "info" | "default"> = {
  ADMIN: "destructive",
  SUB_ADMIN: "warning",
  TPM: "warning",
  PL: "success",
  QUALITY_LEAD: "info",
  EMPLOYEE: "default"
};

const STATUS_TONE: Record<PasswordStatus, "info" | "warning" | "destructive" | "success"> = {
  INITIAL_PASSWORD: "info",
  TEMPORARY_PASSWORD: "warning",
  RESET_REQUIRED: "destructive",
  PASSWORD_UPDATED: "success"
};

const ROLE_ORDER: Role[] = ["ADMIN", "SUB_ADMIN", "TPM", "PL", "QUALITY_LEAD", "EMPLOYEE"];

const RESETTABLE_POSITIONS = new Set<Position>(["TPM", "PL"] as Position[]);

function isResettable(user: AppUser): boolean {
  const pos = user.employee?.position;
  return Boolean(pos && RESETTABLE_POSITIONS.has(pos));
}

function resolvePasswordStatus(user: AppUser): PasswordStatus {
  return (
    user.passwordStatus ??
    derivePasswordStatus({
      mustChangePassword: user.mustChangePassword,
      passwordChangedAt: user.passwordChangedAt,
      passwordResetAt: user.passwordResetAt,
      lastLogin: user.lastLogin
    })
  );
}

export function UserManagement() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmUser, setConfirmUser] = useState<AppUser | null>(null);
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: users, isLoading } = useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then((res) => res.json())
  });

  const resetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        email?: string;
        temporaryPassword?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.temporaryPassword) {
        throw new Error(data.error ?? "Failed to reset password");
      }
      return { email: data.email ?? "", password: data.temporaryPassword };
    },
    onSuccess: (data) => {
      setConfirmUser(null);
      setCopied(false);
      setRevealed(data);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const grouped = useMemo(() => {
    const acc: Record<string, AppUser[]> = {};
    (users ?? []).forEach((u) => {
      (acc[u.role] = acc[u.role] || []).push(u);
    });
    return acc;
  }, [users]);

  const orderedRoles = ROLE_ORDER.filter((r) => grouped[r]?.length);

  async function handleCopy() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed. Select and copy manually.");
    }
  }

  function closeRevealed() {
    setRevealed(null);
    setCopied(false);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-muted/60 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">User Management</CardTitle>
              <CardDescription className="mt-1">
                Reset TPM and Project Lead passwords back to the generated{" "}
                <span className="font-numeric text-foreground">firstName@123</span> default. The user
                will be forced to change it on next login.
              </CardDescription>
            </div>
          </div>
          {users && (
            <Badge variant="secondary" className="tabular">
              {users.length} {users.length === 1 ? "user" : "users"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : (
            orderedRoles.map((roleKey) => (
              <div key={roleKey} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {titleCase(roleKey)}
                  </span>
                  <div className="h-px flex-1 bg-border-subtle" />
                  <span className="text-2xs tabular text-muted-foreground">
                    {grouped[roleKey].length}
                  </span>
                </div>
                <StaggerGroup className="space-y-1.5" stagger={0.02}>
                  {grouped[roleKey].map((u) => {
                    const status = resolvePasswordStatus(u);
                    const canReset = isResettable(u);
                    const isBusy =
                      resetMutation.isPending && resetMutation.variables === u.id;
                    return (
                      <StaggerItem key={u.id}>
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface px-3 py-2 transition-colors duration-150 hover:border-border hover:bg-muted/40">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-9 w-9 border border-border-subtle">
                              <AvatarFallback className="bg-gradient-to-br from-[hsl(243_75%_60%/0.18)] to-[hsl(262_75%_60%/0.18)] text-2xs font-medium text-foreground">
                                {initials(u.name, u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {u.name || "Unnamed"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                              {u.employee?.project?.name && (
                                <p className="truncate text-2xs text-muted-foreground/80">
                                  {u.employee.position
                                    ? `${titleCase(u.employee.position)} · ${u.employee.project.name}`
                                    : u.employee.project.name}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={STATUS_TONE[status]} dot className="shrink-0">
                              {passwordStatusLabel[status]}
                            </Badge>
                            <Badge variant={ROLE_TONE[u.role]} dot className="shrink-0">
                              {titleCase(u.role)}
                            </Badge>
                            {canReset ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => setConfirmUser(u)}
                              >
                                {isBusy ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Resetting
                                  </>
                                ) : (
                                  <>
                                    <KeyRound className="h-3.5 w-3.5" />
                                    Reset Password
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="hidden text-2xs uppercase tracking-[0.12em] text-muted-foreground/60 sm:inline">
                                —
                              </span>
                            )}
                          </div>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </StaggerGroup>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmUser !== null}
        onOpenChange={(open) => {
          if (!open && !resetMutation.isPending) setConfirmUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(35_95%_55%/0.12)] text-[hsl(35_85%_45%)] dark:text-[hsl(35_85%_70%)]">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <DialogTitle>Reset password for this account?</DialogTitle>
            <DialogDescription>
              This will force the user to create a new password after login.
            </DialogDescription>
          </DialogHeader>

          {confirmUser && (
            <div className="rounded-md border border-border-subtle bg-muted/30 px-3 py-2.5 text-sm">
              <p className="font-medium text-foreground">{confirmUser.name || "Unnamed"}</p>
              <p className="text-xs text-muted-foreground">{confirmUser.email}</p>
              <p className="mt-1 text-2xs uppercase tracking-[0.12em] text-muted-foreground">
                {confirmUser.employee?.position
                  ? `${titleCase(confirmUser.employee.position)}${confirmUser.employee.project ? ` · ${confirmUser.employee.project.name}` : ""}`
                  : titleCase(confirmUser.role)}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmUser(null)}
              disabled={resetMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmUser && resetMutation.mutate(confirmUser.id)}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Reset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealed !== null}
        onOpenChange={(open) => {
          if (!open) closeRevealed();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(152_60%_45%/0.12)] text-[hsl(152_65%_35%)] dark:text-[hsl(152_65%_70%)]">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <DialogTitle>Default password generated</DialogTitle>
            <DialogDescription>
              Share this password with {revealed?.email ? <span className="font-numeric text-foreground">{revealed.email}</span> : "the user"}. It will not be shown again.
            </DialogDescription>
          </DialogHeader>

          {revealed && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <code className="flex-1 truncate font-numeric text-base font-semibold text-foreground">
                  {revealed.password}
                </code>
                <Button
                  size="sm"
                  variant={copied ? "default" : "outline"}
                  onClick={handleCopy}
                  aria-label="Copy password"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="flex items-start gap-2 rounded-md border border-[hsl(35_95%_55%/0.35)] bg-[hsl(35_95%_55%/0.08)] px-3 py-2 text-xs text-[hsl(35_85%_38%)] dark:text-[hsl(35_85%_72%)]"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Shown only once. Active sessions for this user have been signed out and they
                  must change their password on next login.
                </span>
              </motion.div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={closeRevealed}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
