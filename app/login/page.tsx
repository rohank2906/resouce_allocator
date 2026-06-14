"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Workflow,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Aurora } from "@/components/effects/aurora";
import { cn } from "@/lib/utils";

const TRUST_ITEMS = [
  {
    icon: Workflow,
    title: "Unified workforce graph",
    body: "Projects, people, and requests stay in lockstep."
  },
  {
    icon: ShieldCheck,
    title: "Role-aware approvals",
    body: "Multi-stage policies route to the right reviewer instantly."
  },
  {
    icon: Sparkles,
    title: "Audit-grade telemetry",
    body: "Every decision recorded with full provenance."
  }
];

const EASE = [0.16, 1, 0.3, 1] as const;

type RoleType = "admin" | "tpm" | "pl";

const ROLE_OPTIONS: Array<{
  value: RoleType;
  label: string;
  icon: React.ElementType;
  hint: string;
}> = [
  { value: "admin", label: "Admin", icon: UserCog, hint: "Full system access" },
  { value: "tpm", label: "TPM", icon: ShieldCheck, hint: "Approvals + dashboards" },
  { value: "pl", label: "Project Lead", icon: Users, hint: "Allocate & approve" }
];

const REDIRECT_BY_ROLE: Record<RoleType, string> = {
  admin: "/admin/dashboard",
  tpm: "/tpm/dashboard",
  pl: "/pl/dashboard"
};

const ROLE_LABEL: Record<RoleType, string> = {
  admin: "Admin",
  tpm: "TPM",
  pl: "Project Lead"
};

const STORAGE_KEY = "allocator.login.role";

function errorMessage(code: string | undefined, role: RoleType): string {
  switch (code) {
    case "DOMAIN_NOT_ALLOWED":
      return "Only @ethara.ai accounts can sign in.";
    case "ROLE_MISMATCH":
      return `This account is not authorized as ${ROLE_LABEL[role]}. Pick the right role above.`;
    case "ACCOUNT_INACTIVE":
      return "This account has been deactivated. Contact your administrator.";
    case "INVALID_CREDENTIALS":
    case "CredentialsSignin":
      return "Invalid email or password.";
    default:
      return code ?? "Something went wrong. Try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<RoleType>("admin");
  const [helpOpen, setHelpOpen] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setChanged(params.get("changed") === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "admin" || stored === "tpm" || stored === "pl") {
      setRole(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, role);
  }, [role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      expectedRole: role,
      redirect: false
    });

    if (result?.error) {
      setError(errorMessage(result.error, role));
      setLoading(false);
      return;
    }

    router.push(REDIRECT_BY_ROLE[role]);
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Aurora className="-z-10" intensity="default" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-[0.14] dark:opacity-[0.09]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/0 via-background/30 to-background/70"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col lg:flex-row">
        <section className="relative flex flex-1 flex-col justify-between px-6 pb-12 pt-12 sm:px-10 lg:px-16 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex items-center gap-3"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] shadow-[0_0_0_1px_hsl(243_70%_45%/0.3),0_8px_24px_-4px_hsl(243_75%_50%/0.45),inset_0_1px_0_0_rgb(255_255_255/0.22)]">
              <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
              <div className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] opacity-40 blur-lg" />
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

          <div className="my-12 max-w-[560px] lg:my-auto lg:py-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.05 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface/60 px-3 py-1 text-2xs font-medium uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-glow" />
              Internal release · v2.5
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE, delay: 0.1 }}
              className="font-display text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl"
            >
              Allocate talent with{" "}
              <span className="gradient-accent">precision</span> and{" "}
              <span className="gradient-accent">grace</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.18 }}
              className="mt-5 max-w-[480px] text-pretty text-md leading-relaxed text-muted-foreground"
            >
              The internal command surface for workforce orchestration — request,
              review, reassign, and report without the spreadsheets.
            </motion.p>

            <motion.ul
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.07, delayChildren: 0.28 } }
              }}
              className="mt-10 space-y-4"
            >
              {TRUST_ITEMS.map((item) => (
                <motion.li
                  key={item.title}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } }
                  }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface/70 backdrop-blur-sm">
                    <item.icon className="h-4 w-4 text-accent" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.body}</span>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="hidden text-2xs uppercase tracking-[0.18em] text-muted-foreground lg:block"
          >
            © {new Date().getFullYear()} Allocator · Internal use only
          </motion.div>
        </section>

        <section className="relative flex flex-1 items-center justify-center px-6 pb-14 sm:px-10 lg:px-12 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.15 }}
            className="relative w-full max-w-[440px]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-[26px] bg-gradient-to-br from-[hsl(243_85%_64%/0.35)] via-transparent to-[hsl(262_85%_64%/0.3)] opacity-70 blur-[2px]"
            />

            <div className="glass-panel-strong relative overflow-hidden rounded-3xl p-7 sm:p-8">
              <div className="aurora-soft" />

              <div className="relative mb-6 flex flex-col">
                <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-border-subtle bg-surface/70 px-2.5 py-0.5 text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  <Lock className="h-3 w-3" strokeWidth={2.4} />
                  Secure sign-in
                </div>
                <h2 className="font-display text-2xl font-semibold tracking-[-0.022em] text-foreground">
                  Welcome back
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose how you sign in, then enter your credentials.
                </p>
              </div>

              {changed && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="relative mb-5 flex items-start gap-2 rounded-lg border border-[hsl(152_60%_45%/0.35)] bg-[hsl(152_60%_45%/0.08)] px-3 py-2 text-sm text-[hsl(152_70%_38%)] dark:text-[hsl(152_70%_70%)]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Password changed successfully. Please log in again.</span>
                </motion.div>
              )}

              <div className="relative mb-5">
                <p className="mb-2 text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Sign in as
                </p>
                <div
                  role="radiogroup"
                  aria-label="Account type"
                  className="grid grid-cols-3 gap-1.5 rounded-xl border border-border-subtle bg-surface/40 p-1 backdrop-blur-sm"
                >
                  {ROLE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = role === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setRole(opt.value)}
                        className={cn(
                          "relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-2xs font-medium transition-all duration-180 ease-spring",
                          active
                            ? "bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] text-white shadow-[0_4px_12px_-2px_hsl(243_85%_60%/0.45),inset_0_1px_0_0_rgb(255_255_255/0.2)]"
                            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                        <span className="leading-none">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-2xs text-muted-foreground">
                  {ROLE_OPTIONS.find((r) => r.value === role)?.hint}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="relative space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    Work email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@ethara.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                    className="input-glow h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label
                      htmlFor="password"
                      className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => setHelpOpen(true)}
                      className="text-2xs font-medium text-muted-foreground transition-colors hover:text-accent"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    id="password"
                    placeholder={role === "admin" ? "Enter your password" : "firstName@123 on first login"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="input-glow h-11"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="flex items-start gap-2 rounded-lg border border-[hsl(0_75%_55%/0.35)] bg-[hsl(0_75%_55%/0.08)] px-3 py-2 text-sm text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_75%)]"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}

                <div className="pt-2">
                  <MagneticButton
                    type="submit"
                    variant="accent"
                    size="lg"
                    disabled={loading}
                    className="group w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in
                      </>
                    ) : (
                      <>
                        Sign in as {ROLE_LABEL[role]}
                        <ArrowRight className="h-4 w-4 transition-transform duration-220 ease-spring group-hover:translate-x-0.5" />
                      </>
                    )}
                  </MagneticButton>
                </div>
              </form>

              <div className="relative mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border-subtle" />
                <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
                  Restricted access
                </span>
                <div className="h-px flex-1 bg-border-subtle" />
              </div>

              <p className="relative mt-4 text-center text-xs text-muted-foreground">
                Only <span className="font-numeric text-foreground">@ethara.ai</span> accounts can sign in.
              </p>
            </div>
          </motion.div>
        </section>
      </div>

      {helpOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          onClick={() => setHelpOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel-strong relative w-full max-w-md rounded-2xl p-6"
          >
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] text-white">
              <KeyRound className="h-4 w-4" />
            </div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Forgot your password?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              For TPM and Project Lead accounts, your initial password is{" "}
              <span className="font-numeric text-foreground">firstName@123</span> (e.g.{" "}
              <span className="font-numeric text-foreground">vyom@123</span> for{" "}
              <span className="font-numeric text-foreground">vyom.sahu@ethara.ai</span>).
              If you have changed it and forgotten the new one, ask an admin to reset it for you.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border-subtle bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
              Admins can reset passwords from <span className="font-numeric text-foreground">Settings → User Management</span>.
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setHelpOpen(false)}>
                Got it
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
