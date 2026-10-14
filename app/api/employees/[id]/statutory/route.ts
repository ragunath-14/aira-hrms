import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { employeeStatutory } from "@/db/schema/payroll";
import { requireRole } from "@/lib/auth/authorization";
import { DEFAULT_PROFILE } from "@/lib/domain/statutory";
import { logAudit } from "@/lib/domain/audit";
import { zodMessage } from "@/lib/format/error-text";
import { isUuid } from "@/lib/validation/ids";
import { employeeStatutorySchema } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

async function findEmployee(tenantId: string, id: string) {
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
    .limit(1);

  return employee ?? null;
}

// PAN, UAN and the tax regime are sensitive: owner, admin and HR only.
export async function GET(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    if (!(await findEmployee(auth.tenant.id, id))) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const [row] = await db
      .select()
      .from(employeeStatutory)
      .where(and(eq(employeeStatutory.tenantId, auth.tenant.id), eq(employeeStatutory.employeeId, id)))
      .limit(1);

    return NextResponse.json({
      pan: row?.pan ?? "",
      uan: row?.uan ?? "",
      esiNumber: row?.esiNumber ?? "",
      pfApplicable: row?.pfApplicable ?? DEFAULT_PROFILE.pfApplicable,
      esiApplicable: row?.esiApplicable ?? DEFAULT_PROFILE.esiApplicable,
      ptApplicable: row?.ptApplicable ?? DEFAULT_PROFILE.ptApplicable,
      taxRegime: row?.taxRegime ?? DEFAULT_PROFILE.taxRegime,
      declaredDeductions: Number(row?.declaredDeductions ?? 0),
    });
  } catch (error) {
    console.error("GET employee statutory error:", error);

    return NextResponse.json({ error: "Failed to load statutory details" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    if (!(await findEmployee(auth.tenant.id, id))) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const parsed = employeeStatutorySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    }

    const data = parsed.data;
    const blank = (value: string | null | undefined) => (value ? value : null);

    // Only the fields that were sent change; the rest keep their value.
    const changes = {
      ...(data.pan !== undefined && { pan: blank(data.pan) }),
      ...(data.uan !== undefined && { uan: blank(data.uan) }),
      ...(data.esiNumber !== undefined && { esiNumber: blank(data.esiNumber) }),
      ...(data.pfApplicable !== undefined && { pfApplicable: data.pfApplicable }),
      ...(data.esiApplicable !== undefined && { esiApplicable: data.esiApplicable }),
      ...(data.ptApplicable !== undefined && { ptApplicable: data.ptApplicable }),
      ...(data.taxRegime !== undefined && { taxRegime: data.taxRegime }),
      ...(data.declaredDeductions !== undefined && {
        declaredDeductions: data.declaredDeductions.toFixed(2),
      }),
      updatedAt: new Date(),
    };

    await db
      .insert(employeeStatutory)
      .values({ tenantId: auth.tenant.id, employeeId: id, ...changes })
      .onConflictDoUpdate({
        target: [employeeStatutory.tenantId, employeeStatutory.employeeId],
        set: changes,
      });

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "employee_statutory_updated",
      entity: "employee",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT employee statutory error:", error);

    return NextResponse.json({ error: "Failed to save statutory details" }, { status: 500 });
  }
}
