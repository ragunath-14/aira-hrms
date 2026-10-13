import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";
import { getCurrentTenant } from "@/lib/auth/authorization";
import { renderPayslip } from "@/lib/domain/payslip-data";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

// Employee: download your own payslip as a PDF. Anyone else's payslip looks
// like it does not exist.
export async function GET(request: Request, { params }: Ctx) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.userId, context.user.id), eq(employees.tenantId, context.tenant.id)))
      .limit(1);

    if (!employee) {
      return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
    }

    const result = await renderPayslip({
      tenantId: context.tenant.id,
      payslipId: id,
      onlyEmployeeId: employee.id,
    });

    if (!result) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    return new Response(Buffer.from(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET employee payslip pdf error:", error);

    return NextResponse.json({ error: "Failed to create the payslip PDF" }, { status: 500 });
  }
}
