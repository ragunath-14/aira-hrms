"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheckIcon } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AttendanceRecord = {
  id: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
};

const PAGE_SIZE = 10;

export default function EmployeeAttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/employee/attendance");
        if (res.ok) {
          const d = await res.json();
          setAttendance(Array.isArray(d) ? d : []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const paged = useMemo(() => paginate(attendance, page, PAGE_SIZE), [attendance, page]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Attendance History</h2>
      </div>
      {attendance.length === 0 ? (
        <EmptyState
          icon={CalendarCheckIcon}
          title="No attendance records"
          description="Your attendance history will appear here."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell>{rec.attendanceDate}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString() : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString() : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={rec.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={attendance.length}
            onPageChange={setPage}
          />
        </>
      )}
    </Card>
  );
}
