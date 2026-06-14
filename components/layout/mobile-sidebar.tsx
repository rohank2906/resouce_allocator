"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  FileText,
  Bell,
  History,
  Settings,
  Sparkles,
  LogOut,
  X,
  UserCircle,
  RefreshCw
} from "lucide-react";
import { cn, initials, titleCase } from "@/lib/utils";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "viewAnalytics" as const },
  { href: "/employees", label: "Employees", icon: Users, permission: "viewAllProjects" as const },
  { href: "/projects", label: "Projects", icon: GitBranch, permission: "viewAllProjects" as const },
  { href: "/requests", label: "Requests", icon: FileText, permission: "viewOwnAssignment" as const },
  { href: "/notifications", label: "Notifications", icon: Bell, permission: "viewOwnAssignment" as const },
  { href: "/sync", label: "Sync Center", icon: RefreshCw, permission: "viewSyncHistory" as const },
  { href: "/audit", label: "Audit", icon: History, permission: "viewAudit" as const },
  { href: "/profile", label: "Profile", icon: UserCircle, permission: "viewOwnAssignment" as const },
  { href: "/settings", label: "Settings", icon: Settings, permission: "manageUsers" as const }
];

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const reduced = useReducedMotion();
  const items = navItems.filter((item) => can(role, item.permission));

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const slideTransition = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 38 };

  return (
    <AnimatePresence>
      {open && (
        <div className="md:hidden">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
            aria-hidden
          />

          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={slideTransition}
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-[300px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-cinematic safe-bottom"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-accent/[0.08] to-transparent" />

            <div className="relative flex h-14 items-center justify-between px-3.5">
              <Link
                href="/dashboard"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-2.5 min-w-0"
              >
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] shadow-[0_0_0_1px_hsl(243_70%_45%/0.25),0_2px_8px_-1px_hsl(243_75%_50%/0.45)]">
                  <Sparkles className="h-4 w-4 text-white" strokeWidth={2.4} />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-[15px] font-semibold leading-tight tracking-tight text-foreground">
                    Allocator
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">
                    Workforce OS
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close menu"
                className="min-tap flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-muted hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-3 h-px bg-sidebar-border" />

            <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin px-2 py-3">
              {items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 text-sm font-medium",
                      "min-tap-y transition-all duration-180 ease-spring",
                      active
                        ? "text-foreground bg-sidebar-accent"
                        : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-muted"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-accent shadow-[0_0_8px_0_hsl(var(--accent)/0.55)]" />
                    )}
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-180",
                        active ? "text-accent" : "group-hover:text-foreground"
                      )}
                      strokeWidth={2}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mx-3 h-px bg-sidebar-border" />

            <div className="p-3">
              <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-muted/60 p-2.5">
                <Avatar className="h-9 w-9 border border-sidebar-border">
                  <AvatarFallback className="bg-gradient-to-br from-[hsl(243_75%_60%)] to-[hsl(262_75%_60%)] text-xs font-medium text-white">
                    {initials(session?.user?.name, session?.user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight text-foreground truncate">
                    {session?.user?.name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {role ? titleCase(role) : "—"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="min-tap shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => signOut()}
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
