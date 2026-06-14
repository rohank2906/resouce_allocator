"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          Something went wrong
        </p>
        <h1 className="text-2xl font-semibold text-text-primary">
          We hit an unexpected error.
        </h1>
        <p className="text-sm text-text-secondary">
          The team has been notified. You can retry, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="text-[11px] font-mono text-text-tertiary">ref: {error.digest}</p>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
          <Button onClick={() => (window.location.href = "/")}>Go home</Button>
        </div>
      </div>
    </div>
  );
}
