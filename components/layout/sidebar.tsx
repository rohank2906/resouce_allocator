"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  FileText,
  Bell,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  UserCircle,
  RefreshCw
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, titleCase } from "@/lib/utils";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";
import { motion } from "framer-motion";

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

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;

  const items = navItems.filter((item) => can(role, item.permission));

  return (
    <aside
      className={cn(
        "relative hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-280 ease-spring",
        collapsed ? "w-[68px]" : "w-[244px]"
      )}
    >
      {/* Subtle gradient wash on top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-accent/[0.06] to-transparent dark:from-accent/[0.08]" />

      {/* Logo */}
      <div className="relative flex h-14 items-center justify-between px-3.5">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-2.5 overflow-hidden",
            collapsed && "justify-center w-full"
          )}
        >
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] shadow-[0_0_0_1px_hsl(243_70%_45%/0.2),0_2px_8px_-1px_hsl(243_75%_50%/0.45)]">
            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-[15px] font-semibold leading-tight tracking-tight text-foreground">
                Allocator
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">
                Workforce OS
              </div>
            </div>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            className="shrink-0 text-muted-foreground"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {collapsed && (
        <div className="px-2 pb-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            className="w-full text-muted-foreground"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="mx-3 h-px bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin px-2 py-3">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center rounded-lg px-2.5 text-sm font-medium",
                "transition-all duration-180 ease-spring",
                collapsed ? "h-9 justify-center" : "h-9 gap-3",
                active
                  ? "text-foreground bg-sidebar-accent"
                  : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-muted"
              )}
              title={collapsed ? item.label : undefined}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-accent shadow-[0_0_8px_0_hsl(var(--accent)/0.55)]"
                />
              )}
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors duration-180",
                  active ? "text-accent" : "group-hover:text-foreground"
                )}
                strokeWidth={2}
              />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 h-px bg-sidebar-border" />

      {/* User */}
      <div className="p-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <Avatar className="h-8 w-8 border border-sidebar-border">
              <AvatarFallback className="bg-sidebar-muted text-xs font-medium">
                {initials(session?.user?.name, session?.user?.email)}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg p-2 transition-colors duration-150 hover:bg-sidebar-muted">
            <Avatar className="h-8 w-8 border border-sidebar-border">
              <AvatarFallback className="bg-gradient-to-br from-[hsl(243_75%_60%)] to-[hsl(262_75%_60%)] text-xs font-medium text-white">
                {initials(session?.user?.name, session?.user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium leading-tight text-foreground truncate">
                {session?.user?.name || "User"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {role ? titleCase(role) : "—"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
