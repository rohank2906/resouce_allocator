"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Briefcase,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCircle
} from "lucide-react";
import type { Role } from "@prisma/client";
import { FadeUp } from "@/components/motion/primitives";
import { initials, titleCase } from "@/lib/utils";
import { roleLabels } from "@/lib/rbac/permissions";

interface ProfileResponse {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  lastLogin: string | null;
  mustChangePassword: boolean;
  employee?: {
    id: string;
    position: string;
    project: { id: string; name: string };
  } | null;
}

export default function ProfilePage() {
  const { data: session } = useSession();

  const { data, isLoading } = useQuery<ProfileResponse>({
    queryKey: ["profile"],
    queryFn: () => fetch("/api/users/me").then((r) => r.json())
  });

  const role = (data?.role ?? session?.user?.role) as Role | undefined;
  const projectName = data?.employee?.project?.name;
  const position = data?.employee?.position;

  return (
    <div className="max-w-3xl space-y-7">
      <FadeUp>
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-muted/40 px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" /> Account
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
            Your account, role, and security controls.
          </p>
        </div>
      </FadeUp>

      <FadeUp delay={0.05}>
        <Card>
          <CardHeader className="flex flex-row items-start gap-4">
            <Avatar className="h-14 w-14 border border-border-subtle shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-[hsl(243_75%_60%)] to-[hsl(262_75%_60%)] text-sm font-semibold text-white">
                {initials(data?.name ?? session?.user?.name, data?.email ?? session?.user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1.5">
              {isLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <CardTitle className="text-lg">{data?.name ?? "Unnamed"}</CardTitle>
              )}
              {isLoading ? (
                <Skeleton className="h-4 w-56" />
              ) : (
                <CardDescription className="font-numeric truncate">{data?.email}</CardDescription>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                {role && (
                  <Badge variant="accent" dot>
                    {roleLabels[role] ?? titleCase(role)}
                  </Badge>
                )}
                {position && (
                  <Badge variant="outline">
                    {titleCase(position)}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <ProfileField icon={Mail} label="Email">
                {data?.email ?? "—"}
              </ProfileField>
              <ProfileField icon={ShieldCheck} label="Role">
                {role ? (roleLabels[role] ?? titleCase(role)) : "—"}
              </ProfileField>
              <ProfileField icon={Briefcase} label="Project">
                {projectName ?? <span className="text-muted-foreground">Not assigned</span>}
              </ProfileField>
              <ProfileField icon={UserCircle} label="Last sign-in">
                {data?.lastLogin ? new Date(data.lastLogin).toLocaleString() : "—"}
              </ProfileField>
            </dl>
          </CardContent>
        </Card>
      </FadeUp>

      <FadeUp delay={0.1}>
        <Card>
          <CardHeader className="flex flex-row items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-muted/60 text-muted-foreground">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription className="mt-1">
                Rotate your password regularly. Use a strong mix of letters, numbers, and symbols.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings/password"
              className="group flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-muted/30 px-4 py-3 transition-colors duration-150 hover:border-border hover:bg-muted/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[hsl(243_85%_64%)] to-[hsl(262_85%_60%)] text-white">
                  <KeyRound className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Change password</p>
                  <p className="text-xs text-muted-foreground">
                    Update your sign-in credentials
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-220 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          </CardContent>
        </Card>
      </FadeUp>

      <FadeUp delay={0.15}>
        <Card>
          <CardHeader className="flex flex-row items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[hsl(0_75%_55%/0.3)] bg-[hsl(0_75%_55%/0.10)] text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)]">
              <LogOut className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Sign out</CardTitle>
              <CardDescription className="mt-1">
                Ends your session on this device.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-[hsl(0_72%_50%)] hover:text-[hsl(0_72%_50%)] dark:text-[hsl(0_85%_72%)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </FadeUp>
    </div>
  );
}

function ProfileField({
  icon: Icon,
  label,
  children
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-muted/30 px-3.5 py-2.5">
      <dt className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground break-words">{children}</dd>
    </div>
  );
}
