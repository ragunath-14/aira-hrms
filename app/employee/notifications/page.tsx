"use client";

import { useEffect, useMemo, useState } from "react";
import { BellIcon } from "lucide-react";

import { EmptyState } from "@/components/hr/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
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
                  {!n.isRead && <Badge className="shrink-0">New</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
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
