import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import { attendance } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import { leaveRequests } from "@/db/schema/leaves";
import { departments, designations } from "@/db/schema/organization";
import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";
import { dateInZone, resolveSettings } from "@/lib/config/settings";

export type PresenceState = "in" | "out" | "away" | "leave";

// Who in a department is working right now. Shows only presence (in, out, away,
// on leave) and work contact details for active colleagues in the same company.
export async function GET(request: Request) {
  try {
    const context = await getOrCreateCurrentEmployee(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant, employee: me } = context;
    const timezone = resolveSettings(tenant.settings).timezone;
    const today = dateInZone(new Date(), timezone);

    const requested = new URL(request.url).searchParams.get("department");
    const selectedId =
      requested === "all" ? null : requested || me.departmentId || null;

    const [departmentRows, people] = await Promise.all([
      db
        .select({ id: departments.id, name: departments.name })
        .from(departments)
        .where(eq(departments.tenantId, tenant.id))
        .orderBy(asc(departments.name)),
      db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          email: employees.email,
          departmentId: employees.departmentId,
          designation: designations.name,
        })
        .from(employees)
        .leftJoin(designations, eq(designations.id, employees.designationId))
        .where(
          and(
            eq(employees.tenantId, tenant.id),
            eq(employees.status, "active"),
            selectedId ? eq(employees.departmentId, selectedId) : undefined,
          ),
        )
        .orderBy(asc(employees.firstName)),
    ]);

    const ids = people.map((p) => p.id);

    const [records, leaves] = ids.length
      ? await Promise.all([
          db
            .select({
              employeeId: attendance.employeeId,
              checkIn: attendance.checkIn,
              checkOut: attendance.checkOut,
              workMode: attendance.workMode,
              breakType: attendance.breakType,
              breakUntil: attendance.breakUntil,
            })
            .from(attendance)
            .where(
              and(
                eq(attendance.tenantId, tenant.id),
                eq(attendance.attendanceDate, today),
                inArray(attendance.employeeId, ids),
              ),
            ),
          db
            .select({
              employeeId: leaveRequests.employeeId,
              startDate: leaveRequests.startDate,
              endDate: leaveRequests.endDate,
            })
            .from(leaveRequests)
            .where(
              and(
                eq(leaveRequests.tenantId, tenant.id),
                eq(leaveRequests.status, "approved"),
                inArray(leaveRequests.employeeId, ids),
                lte(leaveRequests.startDate, today),
                gte(leaveRequests.endDate, today),
              ),
            ),
        ])
      : [[], []];

    const onLeave = new Set(leaves.map((l) => l.employeeId));
    const byEmployee = new Map(records.map((r) => [r.employeeId, r]));

    const members = people.map((p) => {
      const record = byEmployee.get(p.id);
      let state: PresenceState = "away";

      if (onLeave.has(p.id)) state = "leave";
      else if (record?.checkIn && !record.checkOut) state = "in";
      else if (record?.checkOut) state = "out";

      return {
        id: p.id,
        name: [p.firstName, p.lastName].filter(Boolean).join(" "),
        email: p.email,
        designation: p.designation,
        state,
        checkIn: record?.checkIn ?? null,
        checkOut: record?.checkOut ?? null,
        workMode: record?.workMode ?? null,
        // A break only counts while its time has not run out.
        onBreak:
          state === "in" &&
          record?.breakType &&
          record.breakUntil &&
          record.breakUntil.getTime() > Date.now()
            ? { type: record.breakType, until: record.breakUntil }
            : null,
        isYou: p.id === me.id,
      };
    });

    const selected = selectedId
      ? departmentRows.find((d) => d.id === selectedId) ?? null
      : null;

    return NextResponse.json({
      today,
      timezone,
      department: selected
        ? { id: selected.id, name: selected.name }
        : { id: "all", name: tenant.name },
      departments: departmentRows,
      members,
    });
  } catch (error) {
    console.error("GET workplace error:", error);

    return NextResponse.json(
      { error: "Failed to load the workplace" },
      { status: 500 },
    );
  }
}
