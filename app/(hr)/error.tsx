"use client";

import { ErrorState } from "@/components/hr/error-state";

export default function HRError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      title="This page hit a snag"
      description="Something went wrong loading this part of the HR console. Try again, or head back to the dashboard."
      homeHref="/"
      homeLabel="Back to dashboard"
    />
  );
}
