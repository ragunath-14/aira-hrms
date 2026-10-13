"use client";

import { useEffect, useMemo, useState } from "react";
import { BellIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteButton } from "@/components/shared/delete-button";
import { formatDateTime } from "@/lib/format/date";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
};

const PAGE_SIZE = 10;

export default function EmployeeNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/employee/notifications");
        if (res.ok) {
          const d = await res.json();
          setNotifications(Array.isArray(d) ? d : []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const paged = useMemo(() => paginate(notifications, page, PAGE_SIZE), [notifications, page]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
      </div>
      {notifications.length === 0 ? (
        <EmptyState icon={BellIcon} title="No notifications" />
      ) : (
        <>
          <div className="divide-y">
            {paged.map((n) => (
              <div key={n.id} className={`px-6 py-4 ${!n.isRead ? "bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{n.title}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.isRead && <Badge className="shrink-0">New</Badge>}
                    <DeleteButton
                      anyone
                      url={`/api/notifications/${n.id}`}
                      itemName="notification"
                      title="Delete this notification?"
                      onDeleted={() =>
                        setNotifications((prev) => prev.filter((x) => x.id !== n.id))
                      }
                    />
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                {n.link && (
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Join meeting
                  </a>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(n.createdAt)}
                </p>
              </div>
            ))}
          </div>
          <DataTablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={notifications.length}
            onPageChange={setPage}
          />
        </>
      )}
    </Card>
  );
}
