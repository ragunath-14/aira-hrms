import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { requireRole } from "@/lib/auth/authorization";
import {
  MAX_CUSTOM_VALUE_LENGTH,
  resolveCustomFields,
  type CustomFieldDefinition,
} from "@/lib/config/custom-fields";
import { logAudit } from "@/lib/domain/audit";
import { isRealDate } from "@/lib/validation/schemas";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

async function findEmployee(tenantId: string, id: string) {
  const [employee] = await db
    .select({ id: employees.id, values: employees.customFields })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
    .limit(1);

  return employee ?? null;
}

// One value against its field's type. Returns an error message or null.
function problem(field: CustomFieldDefinition, value: string) {
  if (value.length > MAX_CUSTOM_VALUE_LENGTH) {
    return `${field.label} is too long (at most ${MAX_CUSTOM_VALUE_LENGTH} characters)`;
  }

  if (value === "") return null;

  if (field.type === "number" && !/^-?\d+(\.\d+)?$/.test(value)) {
    return `${field.label} must be a number`;
  }

  if (field.type === "date" && !isRealDate(value)) {
    return `${field.label} must be a real date (YYYY-MM-DD)`;
  }

  return null;
}

export async function GET(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const employee = await findEmployee(auth.tenant.id, id);

    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    return NextResponse.json({
      fields: resolveCustomFields(auth.tenant.settings),
      values: employee.values ?? {},
    });
  } catch (error) {
    console.error("GET employee custom fields error:", error);

    return NextResponse.json({ error: "Failed to load the fields" }, { status: 500 });
  }
}

// Save the values for the company's fields. Only fields the company has
// defined are accepted.
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const employee = await findEmployee(auth.tenant.id, id);

    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const body = await request.json().catch(() => null);
    const sent = body && typeof body === "object" && body.values && typeof body.values === "object" ? body.values : null;

    if (!sent) return NextResponse.json({ error: "Send the values to save" }, { status: 400 });

    const fields = resolveCustomFields(auth.tenant.settings);
    const next: Record<string, string> = { ...(employee.values ?? {}) };

    for (const [key, raw] of Object.entries(sent as Record<string, unknown>)) {
      const field = fields.find((f) => f.id === key);

      if (!field) return NextResponse.json({ error: `"${key}" is not one of your custom fields` }, { status: 400 });

      if (typeof raw !== "string") {
        return NextResponse.json({ error: `${field.label} must be text` }, { status: 400 });
      }

      const value = raw.trim();
      const message = problem(field, value);

      if (message) return NextResponse.json({ error: message }, { status: 400 });

      if (value === "") delete next[key];
      else next[key] = value;
    }

    await db
      .update(employees)
      .set({ customFields: next, updatedAt: new Date() })
      .where(and(eq(employees.id, id), eq(employees.tenantId, auth.tenant.id)));

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "employee_custom_fields_updated",
      entity: "employee",
      entityId: id,
    });

    return NextResponse.json({ values: next });
  } catch (error) {
    console.error("PUT employee custom fields error:", error);

    return NextResponse.json({ error: "Failed to save the fields" }, { status: 500 });
  }
}
