"use client";

import { useEffect, useState } from "react";
import { BellIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/hr/page-header";
import { EmptyState } from "@/components/hr/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/notifications");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load notifications");
      }
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notifications",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markAsRead(notificationId: string) {
    try {
      setMarkingId(notificationId);
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update notification");
      }
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification,
        ),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update notification",
      );
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((notification) => !notification.isRead);
    if (unread.length === 0) return;

    await Promise.all(unread.map((notification) => markAsRead(notification.id)));
    toast.success("All notifications marked as read");
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Updates about leave requests, approvals and important HR events."
        action={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              Mark all as read
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
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={BellIcon}
          title="No notifications yet"
          description="You'll see leave approvals, HR updates and other important events here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(!notification.isRead && "ring-primary/30")}
            >
              <CardContent className="flex items-start justify-between gap-4 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-1 flex size-8 shrink-0 items-center justify-center rounded-full",
                      notification.isRead
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    <BellIcon className="size-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <Badge variant="default">New</Badge>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {notification.message}
                    </p>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={markingId === notification.id}
                    onClick={() => markAsRead(notification.id)}
                    aria-label="Mark as read"
                  >
                    <CheckIcon className="size-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
