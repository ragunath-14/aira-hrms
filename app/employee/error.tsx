"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function EmployeePortalError({
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
      description="Something went wrong loading this part of your portal. Try again, or head back to your dashboard."
      homeHref="/employee"
      homeLabel="Back to dashboard"
    />
  );
}
