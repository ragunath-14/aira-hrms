import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/authorization";
import { renderPayslip } from "@/lib/domain/payslip-data";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

// HR: download any payslip in the company as a PDF.
export async function GET(request: Request, { params }: Ctx) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const result = await renderPayslip({ tenantId: auth.tenant.id, payslipId: id });

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
    console.error("GET payslip pdf error:", error);

    return NextResponse.json({ error: "Failed to create the payslip PDF" }, { status: 500 });
  }
}
