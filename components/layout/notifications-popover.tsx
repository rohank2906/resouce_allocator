"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Mail, MailOpen, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  event: string;
  request?: { id: string } | null;
}

interface NotificationsResponse {
  notifications?: NotificationItem[];
  unreadCount?: number;
}

export function NotificationsPopover() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => fetch("/api/notifications").then((r) => r.json()),
    enabled: !!session?.user?.id,
    refetchInterval: open ? 30_000 : false
  });

  const markAllRead = useMutation({
    mutationFn: () => fetch("/api/notifications", { method: "PUT" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] })
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [open]);

  const notifications = (data?.notifications ?? []).slice(0, 6);
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-b from-[hsl(0_75%_60%)] to-[hsl(0_72%_50%)] px-1 text-[9px] font-semibold text-white shadow-[0_0_0_2px_hsl(var(--background)),0_0_8px_0_hsl(0_75%_55%/0.5)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="Recent notifications"
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-xl border border-border bg-surface dark:bg-surface-raised shadow-[0_16px_48px_-12px_rgb(15_23_42/0.18),0_0_0_1px_hsl(var(--border)/0.5)] dark:shadow-[0_20px_60px_-12px_rgb(0_0_0/0.5),0_0_0_1px_hsl(var(--border)),inset_0_1px_0_0_hsl(220_25%_96%/0.04)]"
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold tracking-tight text-foreground">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-px text-[10px] font-medium text-accent tabular">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                    <Bell className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium text-foreground">All caught up</p>
                  <p className="text-xs text-muted-foreground">No new activity right now.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {notifications.map((n) => {
                    const unread = !n.readAt;
                    const Body = (
                      <div className={`relative flex items-start gap-3 px-3.5 py-3 transition-colors duration-150 ${unread ? "bg-accent/[0.04]" : ""} hover:bg-muted/40`}>
                        {unread && (
                          <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_8px_0_hsl(var(--accent)/0.6)]" aria-hidden />
                        )}
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                          unread
                            ? "border-accent/25 bg-accent/10 text-accent"
                            : "border-border-subtle bg-muted/50 text-muted-foreground"
                        }`}>
                          {unread ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium leading-snug text-foreground truncate">
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-snug text-muted-foreground line-clamp-2">
                            {n.body}
                          </p>
                          <p className="mt-1 text-[10.5px] uppercase tracking-wider text-muted-foreground/70 tabular">
                            {format(new Date(n.createdAt), "MMM d · h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                    return (
                      <li key={n.id}>
                        {n.request ? (
                          <Link
                            href={`/requests/${n.request.id}`}
                            onClick={() => setOpen(false)}
                            className="block focus-visible:outline-none focus-visible:bg-muted/40"
                          >
                            {Body}
                          </Link>
                        ) : (
                          Body
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-border-subtle bg-muted/30 px-3.5 py-2">
              <Button asChild variant="ghost" size="sm" className="w-full justify-between text-xs">
                <Link href="/notifications" onClick={() => setOpen(false)}>
                  View all notifications
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
