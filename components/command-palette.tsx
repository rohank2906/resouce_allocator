"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowRight, ArrowUp, ArrowDown, CornerDownLeft,
  LayoutDashboard, Users, GitBranch, FileText, Bell, History, Settings, Sparkles,
  Plus, Sun, Moon, User, Briefcase
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";
import { titleCase } from "@/lib/utils";

type CommandSection = "Navigate" | "Actions" | "Employees" | "Projects" | "Requests";

interface Command {
  id: string;
  label: string;
  hint?: string;
  section: CommandSection;
  icon: React.ElementType;
  iconTone?: string;
  keywords?: string;
  perform: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Employee { id: string; name: string; email: string; position: string; project?: { name: string } | null }
interface Project { id: string; name: string }
interface RequestItem { id: string; title: string; status: string; requestingProject?: { name: string }; sourceProject?: { name: string } }

const SECTION_ORDER: CommandSection[] = ["Navigate", "Actions", "Requests", "Projects", "Employees"];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Data — only fetch when palette is open to save bandwidth
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
    enabled: open
  });
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
    enabled: open
  });
  const { data: requests } = useQuery<RequestItem[]>({
    queryKey: ["requests"],
    queryFn: () => fetch("/api/requests").then((r) => r.json()),
    enabled: open
  });

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const go = useCallback((href: string) => {
    close();
    router.push(href);
  }, [router, close]);

  const isDark = resolvedTheme === "dark" || theme === "dark";

  const commands: Command[] = useMemo(() => {
    const list: Command[] = [];

    // Navigation
    if (can(role, "viewAnalytics")) list.push({ id: "nav-dashboard", label: "Dashboard", hint: "Overview & KPIs", section: "Navigate", icon: LayoutDashboard, perform: () => go("/dashboard"), keywords: "home overview metrics" });
    if (can(role, "viewAllProjects")) list.push({ id: "nav-employees", label: "Employees", hint: "Workforce roster", section: "Navigate", icon: Users, perform: () => go("/employees"), keywords: "people staff" });
    if (can(role, "viewAllProjects")) list.push({ id: "nav-projects", label: "Projects", hint: "All active projects", section: "Navigate", icon: GitBranch, perform: () => go("/projects"), keywords: "teams workstreams" });
    if (can(role, "viewOwnAssignment")) list.push({ id: "nav-requests", label: "Requests", hint: "Resource transfers", section: "Navigate", icon: FileText, perform: () => go("/requests"), keywords: "transfer allocate" });
    if (can(role, "viewOwnAssignment")) list.push({ id: "nav-notifications", label: "Notifications", hint: "Recent activity", section: "Navigate", icon: Bell, perform: () => go("/notifications"), keywords: "alerts updates" });
    if (can(role, "viewAudit")) list.push({ id: "nav-audit", label: "Audit", hint: "Immutable action log", section: "Navigate", icon: History, perform: () => go("/audit"), keywords: "history log" });
    if (can(role, "manageUsers")) list.push({ id: "nav-settings", label: "Settings", hint: "System configuration", section: "Navigate", icon: Settings, perform: () => go("/settings"), keywords: "config admin" });

    // Actions
    if (can(role, "createRequests")) list.push({ id: "act-new-request", label: "New Resource Request", hint: "Request transfer from another project", section: "Actions", icon: Plus, iconTone: "text-accent", perform: () => go("/requests/new"), keywords: "create add" });
    list.push({ id: "act-theme", label: `Switch to ${isDark ? "Light" : "Dark"} mode`, hint: "Toggle theme", section: "Actions", icon: isDark ? Sun : Moon, perform: () => { setTheme(isDark ? "light" : "dark"); close(); }, keywords: "theme dark light mode" });
    list.push({ id: "act-signout", label: "Sign out", hint: "End session", section: "Actions", icon: User, perform: () => { close(); signOut(); }, keywords: "logout exit" });

    // Requests (top 6)
    (requests ?? []).slice(0, 6).forEach((r) => {
      list.push({
        id: `req-${r.id}`,
        label: r.title,
        hint: `${r.requestingProject?.name ?? ""} ← ${r.sourceProject?.name ?? ""} · ${titleCase(r.status)}`,
        section: "Requests",
        icon: FileText,
        perform: () => go(`/requests/${r.id}`),
        keywords: `${r.requestingProject?.name ?? ""} ${r.sourceProject?.name ?? ""} ${r.status}`
      });
    });

    // Projects (top 8)
    (projects ?? []).slice(0, 8).forEach((p) => {
      list.push({
        id: `prj-${p.id}`,
        label: p.name,
        hint: "Open project",
        section: "Projects",
        icon: Briefcase,
        perform: () => go(`/projects/${p.id}`),
        keywords: p.name
      });
    });

    // Employees (top 6)
    (employees ?? []).slice(0, 6).forEach((e) => {
      list.push({
        id: `emp-${e.id}`,
        label: e.name,
        hint: `${titleCase(e.position)} · ${e.project?.name ?? "Unassigned"}`,
        section: "Employees",
        icon: User,
        perform: () => { close(); router.push(`/employees?search=${encodeURIComponent(e.email)}`); },
        keywords: `${e.email} ${e.position} ${e.project?.name ?? ""}`
      });
    });

    return list;
  }, [role, isDark, requests, projects, employees, go, close, router, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const haystack = `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""} ${c.section}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [commands, query]);

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map<CommandSection, Command[]>();
    for (const c of filtered) {
      const list = map.get(c.section) ?? [];
      list.push(c);
      map.set(c.section, list);
    }
    return SECTION_ORDER
      .filter((s) => map.has(s))
      .map((s) => ({ section: s, items: map.get(s)! }));
  }, [filtered]);

  // Flat order for keyboard nav
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Reset active when filter changes
  useEffect(() => { setActiveIndex(0); }, [query]);

  // Scroll active into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLButtonElement>(`[data-cmd-index="${activeIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Global Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange, close]);

  // Local keyboard nav (only when open)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, flatItems.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        flatItems[activeIndex]?.perform();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flatItems, activeIndex]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Close palette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={close}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <div className="absolute inset-0 flex items-start justify-center pt-[14vh] px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.985 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface-raised shadow-[0_24px_64px_-12px_rgb(15_23_42/0.18),0_0_0_1px_hsl(var(--border)/0.6)] dark:shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6),0_0_0_1px_hsl(var(--border)),inset_0_1px_0_0_hsl(220_25%_96%/0.04)]"
            >
              {/* Input row */}
              <div className="relative flex items-center gap-3 border-b border-border-subtle px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects, employees, requests, actions..."
                  className="h-14 w-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  aria-label="Command palette search"
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border-subtle bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Esc
                </kbd>
              </div>

              {/* Results list */}
              <div
                ref={listRef}
                className="max-h-[52vh] overflow-y-auto scrollbar-thin py-2"
              >
                {grouped.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nothing matches</p>
                    <p className="text-xs text-muted-foreground">Try a different search term.</p>
                  </div>
                ) : (
                  grouped.map(({ section, items }) => (
                    <div key={section} className="px-2 pb-2 last:pb-1">
                      <div className="px-2.5 py-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                        {section}
                      </div>
                      <div>
                        {items.map((c) => {
                          const Icon = c.icon;
                          const idx = flatItems.findIndex((f) => f.id === c.id);
                          const active = idx === activeIndex;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              data-cmd-index={idx}
                              onClick={c.perform}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100 ${
                                active ? "bg-accent/10" : "hover:bg-muted/40"
                              }`}
                            >
                              {active && (
                                <motion.span
                                  layoutId="cmd-active"
                                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                  className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-accent shadow-[0_0_8px_0_hsl(var(--accent)/0.6)]"
                                  aria-hidden
                                />
                              )}
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                                active
                                  ? "border-accent/30 bg-accent/15 text-accent"
                                  : "border-border-subtle bg-muted/40 text-muted-foreground"
                              } transition-colors duration-100`}>
                                <Icon className={`h-3.5 w-3.5 ${c.iconTone ?? ""}`} strokeWidth={2} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[13.5px] font-medium leading-tight truncate ${active ? "text-foreground" : "text-foreground/90"}`}>
                                  {c.label}
                                </div>
                                {c.hint && (
                                  <div className="mt-0.5 text-xs text-muted-foreground truncate">{c.hint}</div>
                                )}
                              </div>
                              <ArrowRight className={`h-3.5 w-3.5 shrink-0 transition-all duration-150 ${
                                active ? "text-accent translate-x-0 opacity-100" : "text-muted-foreground opacity-0 -translate-x-1"
                              }`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer hints */}
              <div className="flex items-center justify-between gap-3 border-t border-border-subtle bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <kbd className="inline-flex h-4 w-4 items-center justify-center rounded border border-border-subtle bg-surface font-mono"><ArrowUp className="h-2.5 w-2.5" /></kbd>
                    <kbd className="inline-flex h-4 w-4 items-center justify-center rounded border border-border-subtle bg-surface font-mono"><ArrowDown className="h-2.5 w-2.5" /></kbd>
                    Navigate
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="inline-flex h-4 items-center justify-center rounded border border-border-subtle bg-surface px-1 font-mono"><CornerDownLeft className="h-2.5 w-2.5" /></kbd>
                    Select
                  </span>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 font-medium">
                  <Sparkles className="h-3 w-3 text-accent" />
                  Allocator Search
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
