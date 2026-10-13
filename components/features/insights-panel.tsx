"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CakeIcon,
  CalendarDaysIcon,
  MegaphoneIcon,
  PartyPopperIcon,
  PinIcon,
  SparklesIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Insights = {
  birthdays: { id: string; name: string; date: string; inDays: number }[];
  anniversaries: {
    id: string;
    name: string;
    date: string;
    inDays: number;
    years: number;
  }[];
  holidays: { id: string; name: string; date: string; type: string }[];
  announcements: {
    id: string;
    title: string;
    body: string;
    pinned: boolean;
    createdAt: string;
  }[];
  attendanceWeek:
    | { date: string; present: number; late: number; absent: number }[]
    | null;
  headcountByDepartment: { name: string; total: number }[] | null;
};

function when(inDays: number) {
  if (inDays === 0) return "Today";
  if (inDays === 1) return "Tomorrow";
  return `In ${inDays} days`;
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function InsightsPanel({
  basePath = "",
  variant = "default",
  currentEmployeeId,
}: {
  // "" for the HR console, "/employee" for the self-service portal.
  basePath?: string;
  // "workspace" is the card layout used on the My Workspace dashboard.
  variant?: "default" | "workspace";
  currentEmployeeId?: string;
}) {
  const [data, setData] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/insights")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return null;
  }

  if (!data) {
    return (
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (variant === "workspace") {
    return (
      <WorkspaceInsights
        data={data}
        basePath={basePath}
        currentEmployeeId={currentEmployeeId}
      />
    );
  }

  const week = data.attendanceWeek;
  const weekMax = week
    ? Math.max(1, ...week.map((d) => d.present + d.late + d.absent))
    : 1;
  const deptMax = data.headcountByDepartment
    ? Math.max(1, ...data.headcountByDepartment.map((d) => d.total))
    : 1;

  return (
    <div className="mt-6 space-y-4">
      {(week || data.headcountByDepartment) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {week && (
            <Card>
              <CardHeader>
                <CardTitle>Attendance, last 7 days</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="flex h-40 items-end gap-2"
                  role="img"
                  aria-label="Attendance over the last 7 days"
                >
                  {week.map((d) => {
                    const total = d.present + d.late + d.absent;
                    const day = new Date(d.date + "T00:00:00Z").toLocaleDateString(
                      "en-IN",
                      { weekday: "short", timeZone: "UTC" },
                    );

                    return (
                      <div
                        key={d.date}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                        title={`${shortDate(d.date)}: ${d.present} present, ${d.late} late, ${d.absent} absent`}
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          {total || ""}
                        </span>
                        <div
                          className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-md bg-muted"
                          style={{
                            height: `${Math.max(4, (total / weekMax) * 100)}%`,
                          }}
                        >
                          <div
                            className="bg-emerald-500"
                            style={{ height: `${total ? (d.present / total) * 100 : 0}%` }}
                          />
                          <div
                            className="bg-amber-500"
                            style={{ height: `${total ? (d.late / total) * 100 : 0}%` }}
                          />
                          <div
                            className="bg-rose-500"
                            style={{ height: `${total ? (d.absent / total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <Legend color="bg-emerald-500" label="Present" />
                  <Legend color="bg-amber-500" label="Late" />
                  <Legend color="bg-rose-500" label="Absent" />
                </div>
              </CardContent>
            </Card>
          )}

          {data.headcountByDepartment && (
            <Card>
              <CardHeader>
                <CardTitle>Headcount by department</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.headcountByDepartment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No departments yet.
                  </p>
                ) : (
                  data.headcountByDepartment.slice(0, 7).map((d) => (
                    <div key={d.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="truncate">{d.name}</span>
                        <span className="font-medium">{d.total}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(d.total / deptMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <MegaphoneIcon className="size-4 text-primary" /> Announcements
            </CardTitle>
            <Link
              href={`${basePath}/announcements`}
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No announcements yet.
              </p>
            ) : (
              data.announcements.map((a) => (
                <div key={a.id} className="border-b pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium">
                    {a.pinned && <span aria-label="Pinned">📌 </span>}
                    {a.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {a.body}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 text-primary" /> Upcoming
              holidays
            </CardTitle>
            <Link
              href={`${basePath}/holidays`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Calendar
            </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming holidays.
              </p>
            ) : (
              data.holidays.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate font-medium">{h.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {shortDate(h.date)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CakeIcon className="size-4 text-primary" /> Birthdays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.birthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No birthdays in the next 30 days.
              </p>
            ) : (
              data.birthdays.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate font-medium">{b.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {when(b.inDays)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopperIcon className="size-4 text-primary" /> Work
              anniversaries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.anniversaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No anniversaries in the next 30 days.
              </p>
            ) : (
              data.anniversaries.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate">
                    <span className="font-medium">{a.name}</span>{" "}
                    <span className="text-muted-foreground">
                      · {a.years} {a.years === 1 ? "year" : "years"}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {when(a.inDays)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}


/* ---------------- My Workspace card layout ---------------- */

const DOT_COLORS = [
  "bg-amber-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function dayMonth(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function PanelCard({
  icon,
  iconClass,
  title,
  aside,
  children,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b px-6 py-4">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-foreground">
          <span className={iconClass}>{icon}</span>
          {title}
        </h2>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function WorkspaceInsights({
  data,
  basePath,
  currentEmployeeId,
}: {
  data: Insights;
  basePath: string;
  currentEmployeeId?: string;
}) {
  const linkClass = "text-sm font-semibold text-primary hover:underline";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <PanelCard
          icon={<MegaphoneIcon className="size-5" />}
          iconClass="text-primary"
          title="Announcements"
          aside={
            <Link href={`${basePath}/announcements`} className={linkClass}>
              View all
            </Link>
          }
        >
          {data.announcements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {data.announcements.map((a) => (
                <article
                  key={a.id}
                  className={cn(
                    "rounded-xl border p-4",
                    a.pinned ? "border-primary/20 bg-primary/5" : "bg-card",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {a.pinned && <PinIcon className="mt-0.5 size-4 shrink-0 text-rose-500" aria-label="Pinned" />}
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground">{a.title}</h3>
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{a.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard
          icon={<CakeIcon className="size-5" />}
          iconClass="text-amber-500"
          title="Birthdays"
          aside={<span className="text-sm text-muted-foreground">Next 30 days</span>}
        >
          {data.birthdays.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No birthdays in the next 30 days.</p>
          ) : (
            <ul className="divide-y">
              {data.birthdays.map((b, index) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initialsOf(b.name)}
                    </span>
                    <span className="truncate text-sm font-semibold text-foreground">
                      {b.name}
                      {b.id === currentEmployeeId && (
                        <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                          You
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm",
                      index === 0
                        ? "rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-600"
                        : "text-muted-foreground",
                    )}
                  >
                    {when(b.inDays)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <div className="space-y-6">
        <PanelCard
          icon={<CalendarDaysIcon className="size-5" />}
          iconClass="text-primary"
          title="Upcoming holidays"
          aside={
            <Link href={`${basePath}/holidays`} className={linkClass}>
              Calendar
            </Link>
          }
        >
          {data.holidays.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No upcoming holidays.</p>
          ) : (
            <ul className="divide-y">
              {data.holidays.map((h, index) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={cn("size-2.5 shrink-0 rounded-full", DOT_COLORS[index % DOT_COLORS.length])} />
                    <span className="truncate text-sm font-semibold text-foreground">{h.name}</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-muted px-3 py-1 text-sm font-semibold text-foreground">
                    {dayMonth(h.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          icon={<SparklesIcon className="size-5" />}
          iconClass="text-emerald-500"
          title="Work anniversaries"
          aside={<span className="text-sm text-muted-foreground">Celebrations</span>}
        >
          {data.anniversaries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No anniversaries in the next 30 days.</p>
          ) : (
            <ul className="divide-y">
              {data.anniversaries.map((a, index) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                      {initialsOf(a.name)}
                    </span>
                    <span className="truncate text-sm">
                      <span className="font-semibold text-foreground">{a.name}</span>{" "}
                      <span className="text-muted-foreground">
                        · {a.years} {a.years === 1 ? "year" : "years"}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm",
                      index === 0
                        ? "rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700"
                        : "text-muted-foreground",
                    )}
                  >
                    {when(a.inDays)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
