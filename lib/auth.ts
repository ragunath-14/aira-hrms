import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/db";
import * as schema from "@/db/schema/auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  secret: process.env.BETTER_AUTH_SECRET,

  // RENDER_EXTERNAL_URL is injected by Render, so a fresh deployment works
  // before a custom domain (and BETTER_AUTH_URL) is configured.
  baseURL: process.env.BETTER_AUTH_URL || process.env.RENDER_EXTERNAL_URL,

  emailAndPassword: {
    enabled: true,
  },

  session: {
    // Avoids a DB round-trip on every request by trusting a short-lived,
    // signed session cookie instead of re-validating against the database
    // each time. App-level tenant/role lookups (getCurrentTenant) still hit
    // the DB independently, so a revoked session still stops working within
    // this window's remaining seconds at worst.
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
});