"use client";

import { useEffect, useMemo, useState } from "react";
import { VideoIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dateInZone } from "@/lib/config/settings";
import { getDisplayPrefs, zonedToIso } from "@/lib/format/date";
import { errorText } from "@/lib/format/error-text";

type Person = { id: string; name: string; email: string; isYou: boolean };

const DURATIONS = [15, 30, 45, 60, 90, 120];

// Schedule a video meeting: title, when, how long and who to invite. A video
// link is created automatically and invitees are notified.
export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled: () => void;
}) {
  const { timezone } = getDisplayPrefs();
  const today = dateInZone(new Date(), timezone);

  const [people, setPeople] = useState<Person[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [invited, setInvited] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    fetch("/api/employee/workplace?department=all")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.members) setPeople(data.members);
      })
      .catch(() => {});
  }, [open]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return people
      .filter((p) => !p.isYou)
      .filter((p) => !q || `${p.name} ${p.email}`.toLowerCase().includes(q));
  }, [people, filter]);

  function toggle(id: string) {
    setInvited((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function reset() {
    setTitle("");
    setDescription("");
    setInvited([]);
    setFilter("");
    setDuration(30);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          startsAt: zonedToIso(date, time, timezone),
          durationMinutes: duration,
          attendeeIds: invited,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Could not schedule the meeting"));

      toast.success(
        invited.length
          ? `Meeting scheduled. ${invited.length} invitation${invited.length === 1 ? "" : "s"} sent.`
          : "Meeting scheduled.",
      );
      reset();
      onOpenChange(false);
      onScheduled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not schedule the meeting");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule a meeting</DialogTitle>
          <DialogDescription>
            A video link is created automatically and everyone you invite is notified. Times are in {timezone.replace(/_/g, " ")}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="mt-title" className="mb-1.5">Title</Label>
            <Input id="mt-title" required maxLength={120} placeholder="e.g. Sprint planning" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="mt-date" className="mb-1.5">Date</Label>
              <Input id="mt-date" type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="mt-time" className="mb-1.5">Start time</Label>
              <Input id="mt-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="mt-dur" className="mb-1.5">Duration</Label>
              <select
                id="mt-dur"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {DURATIONS.map((n) => (
                  <option key={n} value={n}>
                    {n >= 60 ? `${n / 60} hr${n > 60 ? "s" : ""}`.replace("1.5 hrs", "1.5 hrs") : `${n} min`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="mt-filter">Invite colleagues</Label>
              <span className="text-xs text-muted-foreground">{invited.length} selected</span>
            </div>
            <Input id="mt-filter" type="search" placeholder="Search by name or email" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <ul className="mt-2 max-h-44 divide-y overflow-y-auto rounded-lg border">
              {shown.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">No one found.</li>
              ) : (
                shown.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/60">
                      <input type="checkbox" className="size-4 accent-primary" checked={invited.includes(p.id)} onChange={() => toggle(p.id)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <Label htmlFor="mt-desc" className="mb-1.5">Description (optional)</Label>
            <Textarea id="mt-desc" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              <VideoIcon /> {saving ? "Scheduling…" : "Schedule meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
