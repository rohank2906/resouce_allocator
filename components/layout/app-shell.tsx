"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { Navbar } from "./navbar";
import { redirect, usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CommandPalette } from "@/components/command-palette";

const PUBLIC_ROUTES = ["/login", "/auth/change-password"];
const FORCE_PW_ALLOWED = new Set([
  "/auth/change-password",
  "/settings/password",
  "/login"
]);

function LoadingShell() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] opacity-30 animate-pulse-glow" />
          <div className="absolute inset-0 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Loading</span>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const mustChangePassword =
    (session?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword === true;

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mustChangePassword && !FORCE_PW_ALLOWED.has(pathname)) {
      router.replace("/auth/change-password");
    }
  }, [mustChangePassword, pathname, router]);

  if (PUBLIC_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return <LoadingShell />;
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 mesh-bg opacity-60" aria-hidden />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.05),transparent_60%)]" aria-hidden />

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <MobileSidebar open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Navbar
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8 safe-bottom"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
