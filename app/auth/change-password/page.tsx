"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Button } from "@/components/ui/button";
import { Aurora } from "@/components/effects/aurora";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";

const EASE = [0.16, 1, 0.3, 1] as const;

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

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? "";
  const [serverError, setServerError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const {
    register,
    handleSubmit,
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
    onSuccess: async () => {
      setServerError(null);
      setSigningOut(true);
      await signOut({ callbackUrl: "/login?changed=true" });
    },
    onError: (err: Error) => {
      setServerError(err.message);
    }
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Aurora className="-z-10" intensity="subtle" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-[0.12] dark:opacity-[0.08]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/0 via-background/30 to-background/70"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mb-6 flex items-center gap-3"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] shadow-[0_0_0_1px_hsl(243_70%_45%/0.3),0_8px_24px_-4px_hsl(243_75%_50%/0.45),inset_0_1px_0_0_rgb(255_255_255/0.22)]">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.4} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm font-semibold tracking-tight text-foreground">
              Allocator
            </span>
            <span className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Workforce OS
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
          className="relative w-full"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-[26px] bg-gradient-to-br from-[hsl(35_95%_55%/0.35)] via-transparent to-[hsl(243_85%_64%/0.3)] opacity-70 blur-[2px]"
          />

          <div className="glass-panel-strong relative overflow-hidden rounded-3xl p-7 sm:p-8">
            <div className="aurora-soft" />

            <div className="relative mb-5 flex flex-col">
              <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-[hsl(35_95%_55%/0.4)] bg-[hsl(35_95%_55%/0.12)] px-2.5 py-0.5 text-2xs font-medium uppercase tracking-[0.14em] text-[hsl(35_85%_45%)] dark:text-[hsl(35_85%_70%)]">
                <Lock className="h-3 w-3" strokeWidth={2.4} />
                Action required
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.022em] text-foreground">
                Change your password
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                You must change your password before continuing. After saving you will be signed out and asked to log in again.
              </p>
              {email && (
                <p className="mt-3 inline-flex items-center gap-1.5 self-start rounded-md border border-border-subtle bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-accent" />
                  Signed in as <span className="font-numeric text-foreground">{email}</span>
                </p>
              )}
            </div>

            <form
              onSubmit={handleSubmit((v) => mutation.mutate(v))}
              className="relative space-y-4"
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="current"
                  className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Current password
                </Label>
                <PasswordInput
                  id="current"
                  autoComplete="current-password"
                  autoFocus
                  className="input-glow h-11"
                  {...register("currentPassword")}
                />
                {errors.currentPassword && (
                  <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="new"
                  className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground"
                >
                  New password
                </Label>
                <PasswordInput
                  id="new"
                  autoComplete="new-password"
                  className="input-glow h-11"
                  {...register("newPassword")}
                />
                <PasswordStrengthMeter value={newPasswordValue} />
                {errors.newPassword && (
                  <p className="text-xs text-destructive">{errors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm"
                  className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Confirm new password
                </Label>
                <PasswordInput
                  id="confirm"
                  autoComplete="new-password"
                  className="input-glow h-11"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              <AnimatePresence initial={false}>
                {serverError && (
                  <motion.div
                    key="err"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="flex items-start gap-2 rounded-lg border border-[hsl(0_75%_55%/0.35)] bg-[hsl(0_75%_55%/0.08)] px-3 py-2 text-sm text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_75%)]"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{serverError}</span>
                  </motion.div>
                )}
                {signingOut && !serverError && (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="flex items-center gap-2 rounded-lg border border-[hsl(152_60%_45%/0.35)] bg-[hsl(152_60%_45%/0.08)] px-3 py-2 text-sm text-[hsl(152_70%_38%)] dark:text-[hsl(152_70%_70%)]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Password updated. Signing you out…</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-2">
                <MagneticButton
                  type="submit"
                  variant="accent"
                  size="lg"
                  disabled={isSubmitting || mutation.isPending || signingOut}
                  className="group w-full"
                >
                  {mutation.isPending || signingOut ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {signingOut ? "Signing out" : "Saving"}
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Save and sign out
                      <ArrowRight className="h-4 w-4 transition-transform duration-220 ease-spring group-hover:translate-x-0.5" />
                    </>
                  )}
                </MagneticButton>
              </div>
            </form>

            <div className="relative mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border-subtle" />
              <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
                Or
              </span>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>

            <div className="relative mt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={async () => {
                  setSigningOut(true);
                  await signOut({ redirect: false });
                  router.replace("/login");
                }}
                disabled={signingOut || mutation.isPending}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out without changing
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
