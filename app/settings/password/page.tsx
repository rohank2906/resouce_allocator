"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, KeyRound, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeUp } from "@/components/motion/primitives";
import { useToast } from "@/lib/toast";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128)
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1)
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const newPasswordValue = useWatch({ control, name: "newPassword" }) ?? "";

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Password updated");
      setServerError(null);
      setDone(true);
      reset();
    },
    onError: (err: Error) => {
      setServerError(err.message);
    }
  });

  return (
    <div className="space-y-8">
      <FadeUp>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Settings
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-0.5 text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-accent" /> Account
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Change password</h1>
            <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
              Rotate the password on your Allocator account. Use 8+ characters with at least one letter and number.
            </p>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.05}>
        <Card className="max-w-xl">
          <CardHeader>
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)]">
              <KeyRound className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <CardTitle>Update password</CardTitle>
            <CardDescription>You will stay signed in after the change.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((v) => mutation.mutate(v))}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="current" className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Current password
                </Label>
                <PasswordInput
                  id="current"
                  autoComplete="current-password"
                  {...register("currentPassword")}
                />
                {errors.currentPassword && (
                  <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new" className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  New password
                </Label>
                <PasswordInput
                  id="new"
                  autoComplete="new-password"
                  {...register("newPassword")}
                />
                <PasswordStrengthMeter value={newPasswordValue} />
                {errors.newPassword && (
                  <p className="text-xs text-destructive">{errors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Confirm new password
                </Label>
                <PasswordInput
                  id="confirm"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
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
                {done && !serverError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 rounded-md border border-[hsl(152_60%_45%/0.35)] bg-[hsl(152_60%_45%/0.08)] px-3 py-2 text-xs text-[hsl(152_70%_38%)] dark:text-[hsl(152_70%_70%)]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Password updated successfully.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    reset();
                    setServerError(null);
                    setDone(false);
                  }}
                  disabled={isSubmitting || mutation.isPending}
                >
                  Reset
                </Button>
                <Button type="submit" variant="accent" disabled={isSubmitting || mutation.isPending}>
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving
                    </>
                  ) : (
                    "Save password"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </FadeUp>
    </div>
  );
}
