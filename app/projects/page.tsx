"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowUpRight, Briefcase, Inbox, Send, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { FadeUp, StaggerGroup, StaggerItem } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { EditProjectDialog, type EditableProject } from "@/components/projects/edit-project-dialog";
import { DeleteProjectDialog, type DeletableProject } from "@/components/projects/delete-project-dialog";
import { can } from "@/lib/rbac/permissions";
import type { Role } from "@prisma/client";

interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  type?: string | null;
  status?: string | null;
  positions: Record<string, number>;
  _count: {
    employees: number;
    incomingRequests: number;
    outgoingRequests: number;
  };
}

const ROLE_GROUPS: { key: string; label: string; tone: string }[] = [
  { key: "PL", label: "Project Leads", tone: "text-[hsl(152_65%_38%)] dark:text-[hsl(152_65%_60%)]" },
  { key: "QUALITY_LEAD", label: "Quality Leads", tone: "text-[hsl(200_85%_42%)] dark:text-[hsl(200_90%_65%)]" },
  { key: "TASKER", label: "FTE Taskers", tone: "text-foreground" },
  { key: "INTERN_TASKER", label: "Intern Taskers", tone: "text-muted-foreground" },
  { key: "ENGINEERING_SUPPORT", label: "Engineering", tone: "text-[hsl(35_85%_42%)] dark:text-[hsl(38_92%_65%)]" },
  { key: "RESEARCH_SUPPORT", label: "Research", tone: "text-[hsl(262_75%_55%)] dark:text-[hsl(262_85%_72%)]" },
  { key: "TPM", label: "TPM", tone: "text-foreground" }
];

export default function ProjectsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = can(role, "manageProjects");

  const [editTarget, setEditTarget] = useState<EditableProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeletableProject | null>(null);

  const { data: projects, isLoading } = useQuery<ProjectListItem[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json())
  });

  const totalEmployees = projects?.reduce((sum, p) => sum + p._count.employees, 0) ?? 0;

  return (
    <div className="space-y-8">
      <FadeUp>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
              Overview of every active project and its staffing composition.
            </p>
          </div>
          {projects && (
            <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-muted/30 px-4 py-2.5">
              <div>
                <div className="font-numeric text-xl font-semibold text-foreground">
                  <AnimatedCounter value={projects.length} />
                </div>
                <div className="text-2xs uppercase tracking-wider text-muted-foreground">Projects</div>
              </div>
              <div className="h-7 w-px bg-border-subtle" />
              <div>
                <div className="font-numeric text-xl font-semibold text-foreground">
                  <AnimatedCounter value={totalEmployees} />
                </div>
                <div className="text-2xs uppercase tracking-wider text-muted-foreground">Members</div>
              </div>
            </div>
          )}
        </div>
      </FadeUp>

      {isLoading ? (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (
        <StaggerGroup className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" stagger={0.05}>
          {projects?.map((project) => {
            const visibleRoles = ROLE_GROUPS.filter((r) => (project.positions[r.key] ?? 0) > 0);
            return (
              <StaggerItem key={project.id}>
                <Link href={`/projects/${project.id}`} className="group block h-full">
                  <Card interactive className="h-full">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-semibold leading-tight text-balance">
                            {project.name}
                          </CardTitle>
                          {project.description && (
                            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                              {project.description}
                            </p>
                          )}
                        </div>
                        {canManage ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            className="shrink-0"
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Manage ${project.name}`}
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-muted/40 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setEditTarget({
                                      id: project.id,
                                      name: project.name,
                                      type: project.type ?? null,
                                      status: project.status ?? null,
                                      description: project.description
                                    })
                                  }
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-2" />
                                  Edit project
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-[hsl(0_72%_50%)] focus:text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)]"
                                  onSelect={() =>
                                    setDeleteTarget({
                                      id: project.id,
                                      name: project.name,
                                      employeeCount: project._count.employees
                                    })
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Delete project
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-muted/40 text-muted-foreground transition-all duration-220 group-hover:bg-accent/10 group-hover:border-accent/30 group-hover:text-accent">
                            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-220 group-hover:translate-x-px group-hover:-translate-y-px" />
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-border-subtle pb-3 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-numeric font-semibold tabular text-foreground">
                          {project._count.employees.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground text-xs">members</span>
                        {(project._count.incomingRequests > 0 || project._count.outgoingRequests > 0) && (
                          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                            {project._count.incomingRequests > 0 && (
                              <span className="inline-flex items-center gap-1" title="Incoming requests">
                                <Inbox className="h-3.5 w-3.5" />
                                <span className="tabular">{project._count.incomingRequests}</span>
                              </span>
                            )}
                            {project._count.outgoingRequests > 0 && (
                              <span className="inline-flex items-center gap-1" title="Outgoing requests">
                                <Send className="h-3.5 w-3.5" />
                                <span className="tabular">{project._count.outgoingRequests}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {visibleRoles.length === 0 ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5" /> No staffing yet
                        </div>
                      ) : (
                        <dl className="-mx-1 divide-y divide-border-subtle/60">
                          {visibleRoles.map((r) => (
                            <div
                              key={r.key}
                              className="flex items-center justify-between px-1 py-1 leading-tight"
                            >
                              <dt className="text-[12px] text-muted-foreground">{r.label}</dt>
                              <dd className={`font-numeric text-[13px] font-semibold tabular ${r.tone}`}>
                                {project.positions[r.key]}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      )}

      <EditProjectDialog
        project={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />
      <DeleteProjectDialog
        project={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </div>
  );
}
