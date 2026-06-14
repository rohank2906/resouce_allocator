"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AuroraProps {
  className?: string;
  intensity?: "subtle" | "default" | "strong";
}

export function Aurora({ className, intensity = "default" }: AuroraProps) {
  const reduced = useReducedMotion();
  const opacityMap = { subtle: 0.4, default: 0.7, strong: 1 } as const;
  const baseOpacity = opacityMap[intensity];

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <motion.div
        className="aurora-blob aurora-blob-1"
        initial={false}
        animate={
          reduced
            ? undefined
            : { x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.08, 0.96, 1] }
        }
        transition={{ duration: 22, ease: "easeInOut", repeat: Infinity }}
        style={{ opacity: baseOpacity }}
      />
      <motion.div
        className="aurora-blob aurora-blob-2"
        initial={false}
        animate={
          reduced
            ? undefined
            : { x: [0, -30, 40, 0], y: [0, 40, -20, 0], scale: [1, 0.95, 1.05, 1] }
        }
        transition={{ duration: 26, ease: "easeInOut", repeat: Infinity, delay: -7 }}
        style={{ opacity: baseOpacity * 0.85 }}
      />
      <motion.div
        className="aurora-blob aurora-blob-3"
        initial={false}
        animate={
          reduced
            ? undefined
            : { x: [0, 30, -40, 0], y: [0, -40, 30, 0], scale: [1, 1.06, 0.94, 1] }
        }
        transition={{ duration: 30, ease: "easeInOut", repeat: Infinity, delay: -14 }}
        style={{ opacity: baseOpacity * 0.9 }}
      />
    </div>
  );
}
