"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Download, Database, CheckCircle2, Sparkles
} from "lucide-react";
import { can } from "@/lib/rbac/permissions";
import { useToast } from "@/lib/toast";
import { useState } from "react";
import type { Role } from "@prisma/client";
import { FadeUp } from "@/components/motion/primitives";
import { UserManagement } from "@/components/settings/user-management";

export default function SettingsPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const role = session?.user?.role as Role | undefined;
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ imported: number; duplicates: number; at: Date } | null>(null);

  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncing(true);
      const res = await fetch("/api/employees/refresh", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      const dupes = data.duplicates?.length || 0;
      setLastSync({ imported: data.imported, duplicates: dupes, at: new Date() });
      toast.success(`Synced: ${data.imported} imported, ${dupes} duplicates`);
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setSyncing(false)
  });

  return (
    <div className="max-w-4xl space-y-8">
      <FadeUp>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-accent" /> System
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
            Manage data sources, users, and platform configuration.
          </p>
        </div>
      </FadeUp>

      {can(role, "importSheets") && (
        <FadeUp delay={0.05}>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-muted/60 text-muted-foreground">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Google Sheets Sync</CardTitle>
                  <CardDescription className="mt-1">
                    Pull employee data from the configured spreadsheet. Duplicates are skipped, new projects are created automatically.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  {lastSync ? (
                    <>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(152_65%_45%/0.12)] text-[hsl(152_65%_38%)] dark:text-[hsl(152_60%_62%)]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Last sync successful</p>
                        <p className="text-xs text-muted-foreground tabular">
                          {lastSync.imported} imported · {lastSync.duplicates} duplicates · {lastSync.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                        <Database className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Ready to sync</p>
                        <p className="text-xs text-muted-foreground">
                          No sync run in this session yet.
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync now"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeUp>
      )}

      {can(role, "manageUsers") && (
        <FadeUp delay={0.1}>
          <UserManagement />
        </FadeUp>
      )}

      <FadeUp delay={0.15}>
        <Card>
          <CardHeader className="flex flex-row items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-muted/60 text-muted-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">About</CardTitle>
              <CardDescription className="mt-1">
                Platform details and database configuration.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border-subtle bg-muted/30 px-3.5 py-2.5">
                <dt className="text-2xs uppercase tracking-wider text-muted-foreground">Version</dt>
                <dd className="mt-0.5 font-numeric text-sm font-semibold text-foreground">1.0.0</dd>
              </div>
              <div className="rounded-md border border-border-subtle bg-muted/30 px-3.5 py-2.5">
                <dt className="text-2xs uppercase tracking-wider text-muted-foreground">Database</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">SQLite <span className="text-muted-foreground">· PostgreSQL ready</span></dd>
              </div>
              <div className="rounded-md border border-border-subtle bg-muted/30 px-3.5 py-2.5 sm:col-span-2">
                <dt className="text-2xs uppercase tracking-wider text-muted-foreground">Platform</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  Internal Resource Allocation &amp; Transfer Management
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </FadeUp>
    </div>
  );
}
