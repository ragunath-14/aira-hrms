import { NextResponse } from "next/server";

import { getCurrentTenant } from "@/lib/auth/authorization";
import { resolveSettings } from "@/lib/config/settings";

// How dates should be shown for this company. Readable by every signed-in
// member (the full settings are limited to owner, admin and HR).
export async function GET(request: Request) {
  const context = await getCurrentTenant(request);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = resolveSettings(context.tenant.settings);

  return NextResponse.json({
    dateFormat: settings.dateFormat,
    timezone: settings.timezone,
    shiftStart: settings.shiftStart,
  });
}
