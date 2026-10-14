"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PLANS, PLAN_IDS } from "@/lib/config/plans";
import { formatSize } from "@/lib/domain/documents-shared";
import { errorText } from "@/lib/format/error-text";
import { formatDate } from "@/lib/format/date";

type PlanInfo = {
  plan: { id: string; label: string; blurb: string };
  employeeLimit: number | null;
  storageBytes: number;
  expiresAt: string | null;
  expired: boolean;
  usage: { people: number; storageBytes: number };
};

function Meter({ label, used, limit, text }: { label: string; used: number; limit: number | null; text: string }) {
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = percent >= 100 ? "bg-destructive" : percent >= 90 ? "bg-amber-500" : "bg-primary";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{text}</span>
      </div>
      {limit !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={label}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

export default function PlanPage() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/plan");
        const data = await res.json();

        if (!res.ok) throw new Error(errorText(data.error, "Failed to load your plan"));

        setInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load your plan");
      }
    }

    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Plan & Usage"
        description="What your company's plan includes and how much of it you are using."
      />

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!info && !error ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : info ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {info.plan.label} plan
                {info.expired ? (
                  <Badge variant="destructive">Expired</Badge>
                ) : (
                  <Badge variant="outline">Active</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Meter
                label="People (employees and logins)"
                used={info.usage.people}
                limit={info.employeeLimit}
                text={`${info.usage.people} of ${info.employeeLimit ?? "unlimited"}`}
              />
              <Meter
                label="Document storage"
                used={info.usage.storageBytes}
                limit={info.storageBytes}
                text={`${formatSize(info.usage.storageBytes)} of ${formatSize(info.storageBytes)}`}
              />
              <p className="text-sm text-muted-foreground">
                {info.expiresAt
                  ? `${info.expired ? "Expired" : "Valid until"} ${formatDate(info.expiresAt)}.`
                  : "No expiry date."}{" "}
                When the plan is full or has expired you can still sign in and see everything, but adding
                people and uploading documents is paused until the platform administrator changes the plan.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available plans</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {PLAN_IDS.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="font-medium text-foreground">{PLANS[id].label}</span>
                    <span className="text-muted-foreground">{PLANS[id].blurb}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                To change your plan, contact the platform administrator.
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
