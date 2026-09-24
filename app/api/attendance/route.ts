import { and, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import { requireRole } from "@/lib/authorization";
import { isUuid } from "@/lib/ids";

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, [
      "owner",
      "admin",
      "hr",
      "manager",
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const { tenant } = auth;

    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get("employeeId");
    const departmentId = searchParams.get("departmentId");
    const date = searchParams.get("date");
    const month = searchParams.get("month");

    if (
      (employeeId && !isUuid(employeeId)) ||
      (departmentId && !isUuid(departmentId))
    ) {
      return Response.json(
        { error: "Invalid employeeId or departmentId" },
        { status: 400 },
      );
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json(
        { error: "date must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }

    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return Response.json(
        { error: "month must be in YYYY-MM format" },
        { status: 400 },
      );
    }

    const conditions = [
      eq(attendance.tenantId, tenant.id),
    ];

    if (employeeId) {
      conditions.push(
        eq(attendance.employeeId, employeeId),
      );
    }

    if (departmentId) {
      conditions.push(
        eq(employees.departmentId, departmentId),
      );
    }

    if (date) {
      conditions.push(
        eq(attendance.attendanceDate, date),
      );
    }

    if (month) {
      const monthStart = `${month}-01`;

      const [year, monthNumber] = month.split("-").map(Number);

      const lastDay = new Date(
        year,
        monthNumber,
        0,
      ).getDate();

      const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

      conditions.push(
        gte(attendance.attendanceDate, monthStart),
      );

      conditions.push(
        lte(attendance.attendanceDate, monthEnd),
      );
    }

    const rows = await db
      .select({
        id: attendance.id,
        tenantId: attendance.tenantId,
        employeeId: attendance.employeeId,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        departmentId: employees.departmentId,
        attendanceDate: attendance.attendanceDate,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        status: attendance.status,
        notes: attendance.notes,
        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt,
      })
      .from(attendance)
      .innerJoin(
        employees,
        eq(attendance.employeeId, employees.id),
      )
      .where(and(...conditions))
      .orderBy(desc(attendance.attendanceDate));

    return Response.json(rows);
  } catch (error) {
    console.error("Attendance list error:", error);

    return Response.json(
      { error: "Failed to fetch attendance" },
      { status: 500 },
    );
  }
}