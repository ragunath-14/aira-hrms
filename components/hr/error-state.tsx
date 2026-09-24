"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ErrorState({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred. You can try again, or head back to a safe page.",
  homeHref = "/",
  homeLabel = "Go to dashboard",
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangleIcon className="size-6 text-destructive" />
          </div>

          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>

          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Reference: <code className="font-mono">{error.digest}</code>
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {reset && (
              <Button variant="outline" onClick={reset}>
                <RotateCcwIcon />
                Try again
              </Button>
            )}

            <Button render={<Link href={homeHref} />}>{homeLabel}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
