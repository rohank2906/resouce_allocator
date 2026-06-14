"use client";

import { cn } from "@/lib/utils";

type Tone = "muted" | "destructive" | "warning" | "success";

function scorePassword(pw: string): { score: number; label: string; tone: Tone } {
  if (!pw) return { score: 0, label: "Enter a password", tone: "muted" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 16) s++;
  const score = Math.min(s, 4);
  const labels = ["Too weak", "Weak", "Fair", "Strong", "Excellent"];
  const tones: Tone[] = ["destructive", "destructive", "warning", "success", "success"];
  return { score, label: labels[score], tone: tones[score] };
}

const FILL: Record<Tone, string> = {
  muted: "bg-muted",
  destructive: "bg-[hsl(0_75%_55%)]",
  warning: "bg-[hsl(35_95%_55%)]",
  success: "bg-[hsl(152_65%_45%)]"
};

const TEXT: Record<Tone, string> = {
  muted: "text-muted-foreground",
  destructive: "text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_75%)]",
  warning: "text-[hsl(35_85%_45%)] dark:text-[hsl(35_85%_70%)]",
  success: "text-[hsl(152_70%_38%)] dark:text-[hsl(152_70%_70%)]"
};

export function PasswordStrengthMeter({ value }: { value: string }) {
  const { score, label, tone } = scorePassword(value);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-220 ease-spring",
              i < score ? FILL[tone] : "bg-border-subtle"
            )}
          />
        ))}
      </div>
      <p className={cn("text-2xs font-medium uppercase tracking-[0.08em]", TEXT[tone])}>
        {label}
      </p>
    </div>
  );
}
