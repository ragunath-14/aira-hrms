"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClockIcon, ShieldAlertIcon } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorText } from "@/lib/format/error-text";

type Access = {
  companyName: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
};

export default function PendingApprovalPage() {
  const router = useRouter();
  const [access, setAccess] = useState<Access | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    try {
      setChecking(true);
      setError("");

      const response = await fetch("/api/tenant");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(errorText(data.error, "Could not check your request"));
      }

      if (data.user?.isSuperAdmin) {
        router.replace("/admin");
        return;
      }

      if (data.tenant.accessStatus === "approved") {
        const role = data.membership?.role;
        router.replace(role === "employee" || role === "member" ? "/employee" : "/");
        return;
      }

      setAccess({
        companyName: data.tenant.name,
        status: data.tenant.accessStatus,
        note: data.tenant.accessNote ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check your request");
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    check();
  }, [check]);

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  const rejected = access?.status === "rejected";
  const Icon = rejected ? ShieldAlertIcon : ClockIcon;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md space-y-5 p-8 text-center">
        {!access && !error ? (
          <div className="space-y-3">
            <Skeleton className="mx-auto h-12 w-12 rounded-full" />
            <Skeleton className="mx-auto h-6 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <Icon className="size-6 text-muted-foreground" />
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-foreground">
                  {rejected ? "Access suspended" : "Waiting for approval"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {rejected
                    ? `Access for ${access?.companyName} has been suspended by the platform owner. Contact them to restore it.`
                    : `Your request for ${access?.companyName} has been sent to the platform owner. You will be able to sign in to the portal as soon as it is approved.`}
                </p>
                {rejected && access?.note && (
                  <p className="rounded-md bg-muted p-3 text-sm text-foreground">
                    {access.note}
                  </p>
                )}
              </>
            )}

            <div className="flex justify-center gap-2">
              <Button onClick={check} disabled={checking}>
                {checking ? "Checking…" : "Check status"}
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
