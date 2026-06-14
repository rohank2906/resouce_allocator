"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";

interface MagneticButtonProps extends Omit<ButtonProps, "ref"> {
  /** Maximum pixels the button can be pulled toward the cursor. Defaults to 8. */
  strength?: number;
  /** Soft halo glow on hover. Defaults to true. */
  glow?: boolean;
}

const SPRING = { stiffness: 220, damping: 18, mass: 0.4 };

/**
 * Premium CTA — magnetically follows the cursor within a radius.
 * Disabled on touch devices, when prefers-reduced-motion is set, or via the reduce-motion media query.
 */
export const MagneticButton = React.forwardRef<HTMLButtonElement, MagneticButtonProps>(
  ({ className, variant, size, asChild, strength = 8, glow = true, children, ...props }, ref) => {
    const reduce = useReducedMotion();
    const localRef = React.useRef<HTMLButtonElement>(null);
    const wrapperRef = React.useRef<HTMLSpanElement>(null);

    React.useImperativeHandle(ref, () => localRef.current as HTMLButtonElement);

    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const xs = useSpring(x, SPRING);
    const ys = useSpring(y, SPRING);

    const handleMove = (e: React.PointerEvent<HTMLSpanElement>) => {
      if (reduce || e.pointerType === "touch") return;
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      const max = Math.max(rect.width, rect.height) / 2;
      const dist = Math.hypot(relX, relY);
      const falloff = Math.max(0, 1 - dist / (max * 1.4));
      x.set((relX / max) * strength * falloff);
      y.set((relY / max) * strength * falloff);
    };

    const handleLeave = () => {
      x.set(0);
      y.set(0);
    };

    const Comp = asChild ? Slot : "button";

    return (
      <motion.span
        ref={wrapperRef}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        style={{ x: xs, y: ys, display: "inline-flex", position: "relative" }}
        className="touch-none"
      >
        {glow && !reduce && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-[radial-gradient(closest-side,hsl(243_85%_64%/0.35),transparent)] opacity-0 blur-md"
            initial={false}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        <Comp
          ref={localRef}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
        >
          {children}
        </Comp>
      </motion.span>
    );
  }
);
MagneticButton.displayName = "MagneticButton";
