"use client";

import { useCallback, useEffect, useState } from "react";
import { PhoneCallIcon, VideoIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTablePagination, clampPage, paginate } from "@/components/shared/data-table-pagination";
import { Button } from "@/components/ui/button";
import { formatDate, getDisplayPrefs } from "@/lib/format/date";
import { cn } from "cn";

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  kind: "instant" | "scheduled" | "call";
  startsAt: string;
  durationMinutes: number;
  status: string;
  joinUrl: string | null;
  joinable: boolean;
  isOrganizer: boolean;
  organizer: string;
  attendees: { id: string; name: string }[];
};

const PAGE_SIZE = 6;

// Upcoming meetings (and past ones on request) with a Join button.
export function MeetingsPanel({ refreshKey }: { refreshKey: number }) {
  const [history, setHistory] = useState(false);
  const [page, setPage] = useState(1);
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [toCancel, setToCancel] = useState<Meeting | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings${history ? "?scope=history" : ""}`);
      const data = await res.json();
      setMeetings(res.ok && Array.isArray(data) ? data : []);
    } catch {
      setMeetings([]);
    }
  }, [history]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      setNow(Date.now());
      load();
    }, 30_000);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  const { timezone } = getDisplayPrefs();
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(iso));

  function startsIn(m: Meeting) {
    const start = new Date(m.startsAt).getTime();
    const end = start + m.durationMinutes * 60_000;
    if (now >= start && now <= end) return { text: "Live now", live: true };
    if (now > end) return { text: "Ended", live: false };
    const mins = Math.round((start - now) / 60_000);
    if (mins < 60) return { text: `Starts in ${Math.max(mins, 1)} min`, live: false };
    if (mins < 24 * 60) return { text: `In ${Math.round(mins / 60)} hr`, live: false };
    return { text: formatDate(m.startsAt), live: false };
  }

  async function cancel() {
    if (!toCancel) return;

    const res = await fetch(`/api/meetings/${toCancel.id}`, { method: "DELETE" });

    if (res.ok) {
      toast.success("Meeting cancelled");
      load();
    } else {
      toast.error("Could not cancel the meeting");
    }

    setToCancel(null);
  }

  return (
    <section aria-label="Meetings">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-foreground">
          Meetings{" "}
          <span className="text-base font-medium text-muted-foreground">({meetings?.length ?? 0})</span>
        </h2>
        <button
          type="button"
          onClick={() => {
            setMeetings(null);
            setPage(1);
            setHistory(!history);
          }}
          className="text-sm font-semibold text-primary underline decoration-dashed underline-offset-4"
        >
          {history ? "Show upcoming" : "View meeting history"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {meetings === null ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : meetings.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            {history ? "No past meetings." : "No scheduled meetings."}
          </p>
        ) : (
          <ul className="divide-y">
            {paginate(meetings, page, PAGE_SIZE).map((m) => {
              const timing = startsIn(m);
              const others = m.attendees.map((a) => a.name);

              return (
                <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-semibold text-foreground">{formatDate(m.startsAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {time(m.startsAt)} · {m.durationMinutes} min
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
                      {m.kind === "call" ? <PhoneCallIcon className="size-4 text-emerald-600" /> : <VideoIcon className="size-4 text-primary" />}
                      <span className="truncate">{m.title}</span>
                      {m.status === "cancelled" && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">Cancelled</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {m.isOrganizer ? "You organised" : `Organised by ${m.organizer}`}
                      {others.length > 0 &&
                        ` · with ${others.slice(0, 3).join(", ")}${others.length > 3 ? ` +${others.length - 3}` : ""}`}
                    </p>
                    {m.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
                  </div>

                  {!history && (
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        timing.live ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {timing.text}
                    </span>
                  )}

                  {!history && m.joinUrl && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={m.joinable || m.isOrganizer ? "default" : "outline"}
                        render={<a href={m.joinUrl} target="_blank" rel="noopener noreferrer" />}
                        title={m.joinable ? "Join the video room" : "The room opens 10 minutes before the start"}
                      >
                        <VideoIcon /> Join
                      </Button>
                      {m.isOrganizer && (
                        <Button size="icon-sm" variant="ghost" aria-label={`Cancel ${m.title}`} onClick={() => setToCancel(m)} className="text-muted-foreground hover:text-destructive">
                          <XIcon />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {meetings && meetings.length > PAGE_SIZE && (
          <DataTablePagination
            page={clampPage(page, meetings.length, PAGE_SIZE)}
            pageSize={PAGE_SIZE}
            total={meetings.length}
            onPageChange={setPage}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!toCancel}
        onOpenChange={(open) => !open && setToCancel(null)}
        title="Cancel this meeting?"
        description={toCancel ? `Everyone invited to "${toCancel.title}" will be notified.` : undefined}
        confirmLabel="Cancel meeting"
        onConfirm={cancel}
      />
    </section>
  );
}
