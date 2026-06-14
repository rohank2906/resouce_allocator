"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck, Mail, MailOpen } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { titleCase } from "@/lib/utils";
import { FadeUp, StaggerGroup, StaggerItem } from "@/components/motion/primitives";

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

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => fetch("/api/notifications").then((res) => res.json())
  });

  const markAllRead = useMutation({
    mutationFn: () => fetch("/api/notifications", { method: "PUT" }).then((res) => res.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] })
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="space-y-8">
      <FadeUp>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-3xl font-semibold tracking-tight">Notifications</h1>
              {unreadCount > 0 && (
                <Badge variant="accent" dot>
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Activity from across the platform.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>
      </FadeUp>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <StaggerGroup className="space-y-2.5" stagger={0.04}>
          {notifications.map((n) => (
            <StaggerItem key={n.id}>
              <Card
                className={
                  !n.readAt
                    ? "border-accent/30 bg-gradient-to-r from-accent/[0.04] to-transparent"
                    : ""
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      !n.readAt
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-border-subtle bg-muted/40 text-muted-foreground"
                    }`}>
                      {n.readAt ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        {!n.readAt && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_0_hsl(var(--accent)/0.6)]" />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{n.body}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(n.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                        <span className="opacity-40">·</span>
                        <Badge variant="secondary" className="text-2xs">{titleCase(n.event)}</Badge>
                      </div>
                    </div>
                    {n.request && (
                      <Button variant="ghost" size="sm" asChild className="shrink-0">
                        <Link href={`/requests/${n.request.id}`}>View</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You have no new notifications.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
