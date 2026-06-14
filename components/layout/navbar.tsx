"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Search, Command, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { NotificationsPopover } from "./notifications-popover";

const PATH_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  projects: "Projects",
  requests: "Requests",
  notifications: "Notifications",
  audit: "Audit",
  settings: "Settings"
};

interface NavbarProps {
  onOpenPalette: () => void;
  onOpenMobileSidebar: () => void;
}

export function Navbar({ onOpenPalette, onOpenMobileSidebar }: NavbarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);

  const segments = pathname.split("/").filter(Boolean);
  const crumbLabel = segments[0] ? (PATH_LABELS[segments[0]] ?? segments[0]) : "";
  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  const isMac = mounted && typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-subtle backdrop-glass px-3 sm:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150 -ml-1"
        >
          <Menu className="h-5 w-5" />
        </button>
        {crumbLabel && (
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="font-display font-semibold text-foreground tracking-tight truncate">
              {crumbLabel}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenPalette}
          className="hidden md:inline-flex items-center gap-2 h-8 pl-2.5 pr-1.5 rounded-md border border-border-subtle bg-muted/40 text-xs text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <kbd className="ml-1 inline-flex items-center gap-0.5 rounded border border-border-subtle bg-surface px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
            {isMac ? <Command className="h-2.5 w-2.5" /> : <span>Ctrl</span>}K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onOpenPalette}
          className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4" />
        </button>

        <NotificationsPopover />

        {mounted && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? "moon" : "sun"}
                initial={{ rotate: -45, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 45, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </Button>
        )}
      </div>
    </header>
  );
}
