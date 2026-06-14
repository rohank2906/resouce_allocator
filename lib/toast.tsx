"use client";

import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toastApi: { success: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void };
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

const TONE: Record<ToastType, { ring: string; bg: string; icon: string; Icon: React.ComponentType<{ className?: string }> }> = {
  success: {
    ring: "ring-[hsl(152_65%_45%/0.3)]",
    bg: "from-[hsl(152_60%_40%/0.08)] to-transparent",
    icon: "text-[hsl(152_65%_45%)]",
    Icon: CheckCircle2
  },
  error: {
    ring: "ring-[hsl(0_75%_55%/0.3)]",
    bg: "from-[hsl(0_75%_55%/0.08)] to-transparent",
    icon: "text-[hsl(0_75%_60%)]",
    Icon: AlertCircle
  },
  info: {
    ring: "ring-[hsl(217_91%_60%/0.3)]",
    bg: "from-[hsl(217_91%_60%/0.08)] to-transparent",
    icon: "text-[hsl(217_91%_60%)]",
    Icon: Info
  }
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastApi = {
    success: (msg: string) => addToast(msg, "success"),
    error: (msg: string) => addToast(msg, "error"),
    info: (msg: string) => addToast(msg, "info")
  };

  return (
    <ToastContext.Provider value={{ toastApi }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)]">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const tone = TONE[t.type];
            const Icon = tone.Icon;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 24, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className={`relative flex items-start gap-3 rounded-xl border border-border bg-surface dark:bg-surface-raised text-sm text-foreground p-3.5 pr-8 shadow-lifted ring-1 ${tone.ring}`}
              >
                <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${tone.bg} pointer-events-none`} />
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon className={`h-4.5 w-4.5 ${tone.icon}`} />
                </div>
                <span className="relative flex-1 leading-snug pt-0.5 text-foreground/90">{t.message}</span>
                <button
                  onClick={() => removeToast(t.id)}
                  className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150"
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toastApi;
}
