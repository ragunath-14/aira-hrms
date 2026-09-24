"use client";

import { useEffect, useState } from "react";

import { RouteTabs } from "@/components/hr/route-tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const LEAVE_NAV = [
  { href: "/employee/leave", label: "Overview", exact: true },
  { href: "/employee/leave/planner", label: "Planner" },
  { href: "/employee/leave/encashment", label: "Encashment" },
  { href: "/employee/leave/adjustment", label: "Adjustment" },
  { href: "/employee/leave/ltc", label: "LTC" },
  { href: "/employee/leave/rules", label: "Rules" },
];

type LeaveType = {
  id: string;
  name: string;
  description: string | null;
  daysPerYear: number;
  carryForwardLimit: number | null;
  maxConsecutiveDays: number | null;
  minNoticeDays: number | null;
  encashmentAllowed: boolean;
  rulesText: string | null;
};

export default function LeaveRulesPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/leave-types");
        if (res.ok) {
          const d = await res.json();
          setLeaveTypes(Array.isArray(d) ? d : []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <RouteTabs tabs={LEAVE_NAV} />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RouteTabs tabs={LEAVE_NAV} />

      <div className="grid gap-4 md:grid-cols-2">
        {leaveTypes.map((lt) => (
          <Card key={lt.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {lt.name}
                {lt.encashmentAllowed && <Badge variant="secondary">Encashable</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lt.description && <p className="text-sm text-muted-foreground">{lt.description}</p>}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Days per year</dt>
                  <dd className="font-medium text-foreground">{lt.daysPerYear}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Carry forward limit</dt>
                  <dd className="font-medium text-foreground">{lt.carryForwardLimit ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Max consecutive days</dt>
                  <dd className="font-medium text-foreground">{lt.maxConsecutiveDays ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Min notice (days)</dt>
                  <dd className="font-medium text-foreground">{lt.minNoticeDays ?? "—"}</dd>
                </div>
              </dl>

              {lt.rulesText && (
                <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                  {lt.rulesText}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
