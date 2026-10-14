import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/authorization";
import { resolveLimits } from "@/lib/config/plans";
import { getUsage } from "@/lib/domain/plans";

// The company's own plan, limits and usage, for Settings -> Plan & usage and
// the warning banner. Owner and admin only.
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const limits = resolveLimits(auth.tenant);
    const usage = await getUsage(auth.tenant.id);

    return NextResponse.json({
      plan: { id: limits.plan.id, label: limits.plan.label, blurb: limits.plan.blurb },
      employeeLimit: limits.employeeLimit,
      storageBytes: limits.storageBytes,
      expiresAt: limits.expiresAt,
      expired: limits.expired,
      usage,
    });
  } catch (error) {
    console.error("GET plan error:", error);

    return NextResponse.json({ error: "Failed to load the plan" }, { status: 500 });
  }
}
