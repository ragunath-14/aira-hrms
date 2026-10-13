import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Defence in depth against CSRF: a state-changing API call that carries an
// Origin header must come from this site (or an explicitly trusted origin).
function isCrossSiteWrite(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }
  if (originHost === host) return false;

  const trusted = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const configured = process.env.BETTER_AUTH_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) trusted.push(configured);

  return !trusted.includes(origin);
}

export async function proxy(request: NextRequest) {
  // No public sign-up: companies and logins are created by the platform owner
  // (and company owners create their own users). Server-side code can still
  // create accounts directly; only the public endpoint is closed.
  if (request.nextUrl.pathname.startsWith("/api/auth/sign-up")) {
    return NextResponse.json(
      { error: "Sign-up is disabled. Ask your administrator for an account." },
      { status: 403 },
    );
  }

  if (request.nextUrl.pathname.startsWith("/api/") && isCrossSiteWrite(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const { pathname } = request.nextUrl;

    // Check if the request is for an API route
    if (pathname.startsWith("/api/")) {
      // Do not block auth routes
      if (pathname.startsWith("/api/auth/")) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Redirect to login page for page routes
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - signup (signup page)
     * - forgot-password, reset-password (password recovery pages)
     */
    "/((?!_next/static|_next/image|favicon.ico|login|signup|forgot-password|reset-password).*)",
  ],
};
