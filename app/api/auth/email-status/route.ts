import { NextResponse } from "next/server";

import { emailConfigured } from "@/lib/email/mailer";

// Public, so the "Forgot password" page can tell people when the deployment
// cannot send email (and who to ask instead). Reveals nothing else.
export function GET() {
  return NextResponse.json({ enabled: emailConfigured() });
}
