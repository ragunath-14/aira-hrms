"use client";

import { useEffect } from "react";
import "./globals.css";

// This replaces the entire root layout when an error escapes even that
// layout, so it stays deliberately minimal and self-contained rather than
// reusing shared components that could themselves be implicated in the
// failure.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground antialiased">
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center">
          <p className="text-base font-semibold">Something went wrong</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            The application ran into an unexpected error. Please try again.
          </p>

          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Reference: <code className="font-mono">{error.digest}</code>
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
