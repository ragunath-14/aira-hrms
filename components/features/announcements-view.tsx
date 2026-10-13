"use client";

import { useEffect, useState } from "react";
import { MegaphoneIcon, PinIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { errorText } from "@/lib/format/error-text";
import { formatDate } from "@/lib/format/date";
import { DataTablePagination, clampPage, paginate } from "@/components/shared/data-table-pagination";

type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(iso);
}

const PAGE_SIZE = 8;

export function AnnouncementsView({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ title: "", body: "", pinned: false });

  const [toDelete, setToDelete] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setError("");
      const res = await fetch("/api/announcements");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(errorText(data.error, "Failed to load announcements"));
      }

      setItems(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load announcements",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and message are required");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("Failed to post announcement");
      }

      toast.success("Announcement posted and everyone notified");
      setShowForm(false);
      setForm({ title: "", body: "", pinned: false });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(item: Announcement) {
    const res = await fetch(`/api/announcements/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !item.pinned }),
    });

    if (!res.ok) {
      toast.error("Failed to update announcement");
      return;
    }

    load();
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/announcements/${toDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete announcement");
      }

      toast.success("Announcement deleted");
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Announcements"
        description="News and updates from HR."
        action={
          canManage ? (
            <Button onClick={() => setShowForm(true)}>
              <PlusIcon /> New Announcement
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MegaphoneIcon}
          title="No announcements yet"
          description={
            canManage
              ? "Post an update and everyone in the company is notified."
              : "You're all caught up."
          }
        />
      ) : (
        <div className="space-y-3">
          {paginate(items, page, PAGE_SIZE).map((item) => (
            <Card
              key={item.id}
              className={`p-4 ${item.pinned ? "border-primary/40 bg-primary/5" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{item.title}</h2>
                    {item.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <PinIcon className="size-3" /> Pinned
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {timeAgo(item.createdAt)}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
                    {item.body}
                  </p>
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={item.pinned ? "Unpin" : "Pin"}
                      onClick={() => togglePin(item)}
                    >
                      <PinIcon
                        className={
                          item.pinned ? "text-primary" : "text-muted-foreground"
                        }
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete announcement"
                      onClick={() => setToDelete(item)}
                    >
                      <Trash2Icon className="text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}

          <div className="overflow-hidden rounded-xl border bg-card">
            <DataTablePagination
              page={clampPage(page, items.length, PAGE_SIZE)}
              pageSize={PAGE_SIZE}
              total={items.length}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>
              Everyone in the company gets a notification.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="announcement-title" className="mb-1.5">
                Title
              </Label>
              <Input
                id="announcement-title"
                value={form.title}
                maxLength={150}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="announcement-body" className="mb-1.5">
                Message
              </Label>
              <Textarea
                id="announcement-body"
                rows={5}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="size-4 rounded border-input"
              />
              Pin to the top
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Posting…" : "Post"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete announcement?"
        description={toDelete ? `"${toDelete.title}" will be removed for everyone.` : undefined}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
