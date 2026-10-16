import { timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";

import { deliverDue } from "@/lib/domain/webhooks";

// For a scheduler (a Render Cron Job, for example) to call every few minutes so
// webhooks that failed are retried even when nothing new is happening. Needs
// the CRON_SECRET environment variable; without it this does not exist.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 16) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const given = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await deliverDue());
  } catch (error) {
    console.error("Webhook run:", error);
    return NextResponse.json({ error: "Failed to run the deliveries" }, { status: 500 });
  }
}
