"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";

import { formatSize } from "@/lib/domain/documents-shared";

type PlanInfo = {
  plan: { label: string };
  employeeLimit: number | null;
  storageBytes: number;
  expired: boolean;
  usage: { people: number; storageBytes: number };
};

// A warning strip for the company owner and admins when the plan has expired or
// is nearly full. Silent for everyone else (the API refuses other roles) and
// whenever there is nothing to warn about.
export function PlanBanner() {
  const [info, setInfo] = useState<PlanInfo | null>(null);

  useEffect(() => {
    fetch("/api/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  if (!info) return null;

  const peopleFull = info.employeeLimit !== null && info.usage.people >= info.employeeLimit;
  const peopleNear = info.employeeLimit !== null && !peopleFull && info.usage.people >= info.employeeLimit * 0.9;
  const storageFull = info.usage.storageBytes >= info.storageBytes;
  const storageNear = !storageFull && info.usage.storageBytes >= info.storageBytes * 0.9;

  let message = "";

  if (info.expired) {
    message = `Your ${info.plan.label} plan has expired. You can still see your data, but adding people and uploading documents is paused.`;
  } else if (peopleFull) {
    message = `You have reached your ${info.plan.label} plan's limit of ${info.employeeLimit} people. Adding more is paused.`;
  } else if (storageFull) {
    message = `Document storage is full (${formatSize(info.storageBytes)}). Uploading is paused.`;
  } else if (peopleNear) {
    message = `You are using ${info.usage.people} of ${info.employeeLimit} people on your ${info.plan.label} plan.`;
  } else if (storageNear) {
    message = `Document storage is almost full (${formatSize(info.usage.storageBytes)} of ${formatSize(info.storageBytes)}).`;
  }

  if (!message) return null;

  const blocking = info.expired || peopleFull || storageFull;

  return (
    <div
      role="status"
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
        blocking
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
      }`}
    >
      <AlertTriangleIcon className="size-4 shrink-0" />
      <span className="flex-1">{message} Ask the platform administrator to change your plan.</span>
      <Link href="/settings/plan" className="font-medium underline underline-offset-2">
        Plan &amp; usage
      </Link>
    </div>
  );
}
