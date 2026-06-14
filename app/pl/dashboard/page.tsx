"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import DashboardPage from "@/app/dashboard/page";

export default function PlDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: Role } | undefined)?.role;
    if (role !== "SUB_ADMIN" && role !== "ADMIN") router.replace("/dashboard");
  }, [session, status, router]);

  return <DashboardPage />;
}
