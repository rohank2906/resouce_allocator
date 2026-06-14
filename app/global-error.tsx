"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0c",
          color: "#f1f1f3",
          padding: "24px"
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#9ca3af",
              margin: 0
            }}
          >
            Fatal error
          </p>
          <h1 style={{ marginTop: 8, fontSize: 22 }}>The application crashed.</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#c4c4c8" }}>
            Reload the page. If this keeps happening, contact the administrator.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 12,
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#6b7280"
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 20,
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid #2c2c30",
              background: "#15151a",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer"
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
