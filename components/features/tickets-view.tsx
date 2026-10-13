"use client";

import { useEffect, useMemo, useState } from "react";
import { BanIcon, LifeBuoyIcon, MessageSquareIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ErrorBanner,
  Pill,
  apiError,
  labelize,
  selectClass,
  type Tone,
} from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DeleteButton } from "@/components/shared/delete-button";
import { cn } from "cn";
import { formatDateTime } from "@/lib/format/date";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  description: string;
  employeeName: string;
  employeeCode: string;
  commentCount: number;
  updatedAt: string;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
  deleted?: boolean;
  isMine?: boolean;
  canDelete?: boolean;
};
type Detail = Ticket & { comments: Comment[] };

const STATUS_TONE: Record<Ticket["status"], Tone> = {
  open: "amber",
  in_progress: "blue",
  resolved: "green",
  closed: "gray",
};
const PRIORITY_TONE: Record<Ticket["priority"], Tone> = { low: "gray", medium: "blue", high: "red" };
const STATUSES: Ticket["status"][] = ["open", "in_progress", "resolved", "closed"];

const categoryLabel = (c: string) => (c === "it" ? "IT" : labelize(c));

function when(iso: string) {
  return formatDateTime(iso);
}

export function TicketsView({ isHr }: { isHr: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | Ticket["status"]>("all");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "other", priority: "medium", description: "" });

  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Comment | null>(null);

  async function load() {
    try {
      setError("");
      const res = await fetch("/api/tickets");
      if (!res.ok) throw new Error(await apiError(res, "Failed to load tickets"));
      setTickets(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(
    () => (filter === "all" ? tickets : tickets.filter((t) => t.status === filter)),
    [tickets, filter],
  );

  async function open(id: string) {
    const res = await fetch(`/api/tickets/${id}`);

    if (!res.ok) {
      toast.error(await apiError(res, "Failed to open ticket"));
      return;
    }

    setDetail(await res.json());
    setReply("");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(await apiError(res, "Failed to create ticket"));

      toast.success("Ticket raised");
      setShowForm(false);
      setForm({ ...form, subject: "", description: "" });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSaving(false);
    }
  }

  // Delete for everyone: the message turns into "This message was deleted".
  async function deleteMessage() {
    const target = messageToDelete;
    if (!detail || !target) return;

    setMessageToDelete(null);
    const previous = detail;

    setDetail({
      ...detail,
      comments: detail.comments.map((c) =>
        c.id === target.id ? { ...c, body: "", deleted: true, canDelete: false } : c,
      ),
    });

    try {
      const res = await fetch(`/api/tickets/${detail.id}/comments/${target.id}`, { method: "DELETE" });

      if (!res.ok) throw new Error(await apiError(res, "Could not delete the message"));

      load();
    } catch (err) {
      setDetail(previous);
      toast.error(err instanceof Error ? err.message : "Could not delete the message");
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!detail || !text || sending) return;

    setSending(true);

    // Show the reply straight away; the refresh below replaces it with the
    // saved copy (and the box is restored if saving fails).
    const previous = detail;
    setDetail({
      ...detail,
      comments: [
        ...detail.comments,
        { id: `pending-${Date.now()}`, body: text, createdAt: new Date().toISOString(), authorName: "You" },
      ],
    });
    setReply("");

    try {
      const res = await fetch(`/api/tickets/${detail.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });

      if (!res.ok) throw new Error(await apiError(res, "Failed to send reply"));

      open(detail.id);
      load();
    } catch (err) {
      setDetail(previous);
      setReply(text);
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: Ticket["status"]) {
    if (!detail) return;

    const res = await fetch(`/api/tickets/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      toast.error(await apiError(res, "Failed to update ticket"));
      return;
    }

    toast.success(`Ticket ${labelize(status).toLowerCase()}`);
    open(detail.id);
    load();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={isHr ? "Helpdesk" : "Help & Support"}
        description={isHr ? "Answer employee questions and resolve requests." : "Raise a question or request and track HR's reply."}
        action={
          <Button onClick={() => setShowForm(true)}>
            <PlusIcon /> New Ticket
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-background p-1 sm:w-fit">
        {(["all", ...STATUSES] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              f === filter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : labelize(f)}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={LifeBuoyIcon}
          title="No tickets"
          description={isHr ? "Requests from employees appear here." : "Raise a ticket and HR will get back to you."}
        />
      ) : (
        <Card className="divide-y overflow-hidden p-0">
          {shown.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => open(t.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isHr && `${t.employeeName} · `}{categoryLabel(t.category)} · updated {when(t.updatedAt)}
                </p>
              </div>
              {t.commentCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquareIcon className="size-3.5" /> {t.commentCount}
                </span>
              )}
              <Pill tone={PRIORITY_TONE[t.priority]}>{labelize(t.priority)}</Pill>
              <Pill tone={STATUS_TONE[t.status]}>{labelize(t.status)}</Pill>
            </button>
          ))}
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Ticket</DialogTitle>
            <DialogDescription>HR is notified straight away.</DialogDescription>
          </DialogHeader>

          <form onSubmit={create} className="space-y-4">
            <div>
              <Label htmlFor="ticket-subject" className="mb-1.5">Subject</Label>
              <Input id="ticket-subject" required maxLength={150} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ticket-category" className="mb-1.5">Category</Label>
                <select id="ticket-category" className={selectClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {["payroll", "leave", "it", "policy", "other"].map((c) => (
                    <option key={c} value={c}>{c === "it" ? "IT" : labelize(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="ticket-priority" className="mb-1.5">Priority</Label>
                <select id="ticket-priority" className={selectClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {["low", "medium", "high"].map((p) => (
                    <option key={p} value={p}>{labelize(p)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="ticket-description" className="mb-1.5">Details</Label>
              <Textarea id="ticket-description" required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Raising…" : "Raise ticket"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.subject}</DialogTitle>
                <DialogDescription>
                  {isHr && `${detail.employeeName} · `}{categoryLabel(detail.category)} · {labelize(detail.priority)} priority
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2">
                <Pill tone={STATUS_TONE[detail.status]}>{labelize(detail.status)}</Pill>
                {isHr ? (
                  <select
                    aria-label="Ticket status"
                    className={`${selectClass} ml-auto max-w-40`}
                    value={detail.status}
                    onChange={(e) => setStatus(e.target.value as Ticket["status"])}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{labelize(s)}</option>
                    ))}
                  </select>
                ) : (
                  detail.status !== "closed" && (
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => setStatus("closed")}>
                      Close ticket
                    </Button>
                  )
                )}
              </div>

              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{detail.description}</p>

              {isHr && (
                <div className="-mt-2 flex justify-end">
                  <DeleteButton
                    withLabel
                    url={`/api/tickets/${detail.id}`}
                    itemName="ticket"
                    description="The ticket and all its replies will be removed."
                    onDeleted={() => {
                      setDetail(null);
                      load();
                    }}
                  />
                </div>
              )}

              <div className="space-y-3">
                {detail.comments.map((c) => (
                  <div key={c.id} className={cn("group flex", c.isMine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "relative max-w-[85%] rounded-2xl border px-3.5 py-2.5",
                        c.isMine ? "rounded-br-sm border-primary/20 bg-primary/10" : "rounded-bl-sm bg-card",
                        c.deleted && "border-dashed bg-muted/40",
                      )}
                    >
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{c.isMine ? "You" : (c.authorName ?? "User")}</span> · {when(c.createdAt)}
                      </p>

                      {c.deleted ? (
                        <p className="mt-1 flex items-center gap-1.5 text-sm italic text-muted-foreground">
                          <BanIcon className="size-3.5" />
                          {c.isMine ? "You deleted this message" : "This message was deleted"}
                        </p>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                      )}

                      {c.canDelete && (
                        <button
                          type="button"
                          aria-label="Delete message"
                          title="Delete message"
                          onClick={() => setMessageToDelete(c)}
                          className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground opacity-0 shadow-sm transition hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {detail.status !== "closed" && (
                <form onSubmit={sendReply} className="flex gap-2">
                  <Input aria-label="Reply" placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
                  <Button type="submit" disabled={!reply.trim() || sending}>{sending ? "Sending…" : "Send"}</Button>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!messageToDelete}
        onOpenChange={(open) => !open && setMessageToDelete(null)}
        title="Delete message?"
        description="It will be deleted for everyone in this ticket. They will see that a message was deleted."
        confirmLabel="Delete for everyone"
        onConfirm={deleteMessage}
      />
    </div>
  );
}
