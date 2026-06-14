"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative flex h-12 w-12 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] opacity-25"
            animate={{ scale: [1, 1.08, 1], opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-0 rounded-2xl border border-accent/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
            style={{ borderTopColor: "hsl(var(--accent))" }}
          />
          <Sparkles className="relative h-5 w-5 text-accent" strokeWidth={2.2} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="font-display text-sm font-medium tracking-tight text-foreground">
            Preparing your view
          </span>
          <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground">
            Loading
          </span>
        </div>
      </motion.div>
    </div>
  );
}
