"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Plus, ArrowRight, Calendar, Inbox } from "lucide-react";
import { titleCase } from "@/lib/utils";
import { can } from "@/lib/rbac/permissions";
import { format } from "date-fns";
import type { Role } from "@prisma/client";
import { FadeUp, StaggerGroup, StaggerItem } from "@/components/motion/primitives";

const statusColor: Record<string, "warning" | "success" | "info" | "destructive" | "default"> = {
  PENDING: "warning",
  APPROVED: "success",
  PARTIALLY_APPROVED: "info",
  REJECTED: "destructive",
  COMPLETED: "default"
};

interface RequestItem {
  id: string;
  title: string;
  status: string;
  taskersNeeded: number;
  qualityLeadsNeeded: number;
  createdAt: string;
  requiredBy?: string | null;
  requestingProject?: { name: string };
  sourceProject?: { name: string };
}

export default function RequestsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;

  const { data: requests, isLoading } = useQuery<RequestItem[]>({
    queryKey: ["requests"],
    queryFn: () => fetch("/api/requests").then((res) => res.json())
  });

  return (
    <div className="space-y-8">
      <FadeUp>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Resource Requests</h1>
            <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
              Track inbound and outbound transfer requests across projects.
            </p>
          </div>
          {can(role, "createRequests") && (
            <Button asChild variant="accent" size="default" className="shrink-0">
              <Link href="/requests/new">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Request</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          )}
        </div>
      </FadeUp>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-80 rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <FadeUp delay={0.05}>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="PENDING">Pending</TabsTrigger>
              <TabsTrigger value="APPROVED">Approved</TabsTrigger>
              <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
              <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
            </TabsList>

            {["all", "PENDING", "APPROVED", "COMPLETED", "REJECTED"].map((tab) => {
              const filtered = Array.isArray(requests)
                ? requests.filter((req) => tab === "all" || req.status === tab)
                : [];

              return (
                <TabsContent key={tab} value={tab}>
                  {filtered.length > 0 ? (
                    <StaggerGroup className="space-y-2.5" stagger={0.04}>
                      {filtered.map((req) => (
                        <StaggerItem key={req.id}>
                          <Link href={`/requests/${req.id}`} className="block group">
                            <Card interactive className="group/card">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2.5">
                                      <p className="font-medium text-foreground truncate group-hover:text-accent transition-colors duration-150">
                                        {req.title}
                                      </p>
                                      <Badge variant={statusColor[req.status] ?? "default"} dot>
                                        {titleCase(req.status)}
                                      </Badge>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground/80">
                                        {req.requestingProject?.name}
                                      </span>
                                      <ArrowRight className="h-3 w-3 opacity-60" />
                                      <span className="font-medium text-foreground/80">
                                        {req.sourceProject?.name}
                                      </span>
                                      <span className="mx-1 opacity-40">·</span>
                                      <span className="tabular">{req.taskersNeeded} Taskers</span>
                                      {req.qualityLeadsNeeded > 0 && (
                                        <>
                                          <span className="mx-1 opacity-40">·</span>
                                          <span className="tabular">{req.qualityLeadsNeeded} QL</span>
                                        </>
                                      )}
                                    </div>
                                    <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                                      <Calendar className="h-3 w-3 opacity-60" />
                                      Created {format(new Date(req.createdAt), "MMM d, yyyy")}
                                      {req.requiredBy && (
                                        <>
                                          <span className="mx-0.5 opacity-40">·</span>
                                          <span>Due {format(new Date(req.requiredBy), "MMM d, yyyy")}</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-220 group-hover/card:opacity-100 group-hover/card:translate-x-0.5 mt-1" />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        </StaggerItem>
                      ))}
                    </StaggerGroup>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                          <Inbox className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">No requests found</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tab === "all"
                              ? "There are no resource requests in the system yet."
                              : `No requests with status "${titleCase(tab)}".`}
                          </p>
                        </div>
                        {can(role, "createRequests") && tab === "all" && (
                          <Button variant="outline" size="sm" className="mt-2" asChild>
                            <Link href="/requests/new">Create your first request</Link>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </FadeUp>
      )}
    </div>
  );
}
