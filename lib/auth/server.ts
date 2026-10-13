import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/db";
import { sendEmail } from "@/lib/email/mailer";
import { passwordChangedEmail, passwordResetEmail } from "@/lib/email/templates";
import * as schema from "@/db/schema/auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  secret: process.env.BETTER_AUTH_SECRET,

  // Two-factor sign-in with an authenticator app (Google Authenticator,
  // Microsoft Authenticator, Authy ...) plus one-time recovery codes. The
  // secret and the codes are stored encrypted.
  plugins: [twoFactor({ issuer: "AIRA HRMS" })],

  // RENDER_EXTERNAL_URL is injected by Render, so a fresh deployment works
  // before a custom domain (and BETTER_AUTH_URL) is configured.
  baseURL: process.env.BETTER_AUTH_URL || process.env.RENDER_EXTERNAL_URL,

  // Extra origins that are allowed to make auth requests (e.g. ngrok tunnels
  // for local testing). Set BETTER_AUTH_TRUSTED_ORIGINS to a comma-separated
  // list of origins, e.g. "https://abc123.ngrok-free.dev".
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim())
    : [],

  emailAndPassword: {
    enabled: true,
    // Passwords are stored only as salted scrypt hashes in the "account"
    // table, never in plain text.
    minPasswordLength: 12,
    maxPasswordLength: 128,

    // "Forgot password": the link is emailed (see lib/email/mailer.ts) and is
    // valid for one hour. Resetting signs the person out everywhere.
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited: the response must not reveal, through timing, whether an
      // email address has an account.
      void sendEmail({ to: user.email, ...passwordResetEmail(user.name, url) });
    },
    onPasswordReset: async ({ user }) => {
      void sendEmail({ to: user.email, ...passwordChangedEmail(user.name) });
    },
  },

  // Brute-force protection (always on in production). Counters are kept in
  // memory, which is correct for a single instance such as the Render
  // Blueprint; use "database" storage if you scale to several instances.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
      "/reset-password": { window: 3600, max: 10 },
      "/change-password": { window: 3600, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 10 },
      "/two-factor/verify-backup-code": { window: 60, max: 10 },
    },
  },

  advanced: {
    // Always send the Secure flag in production (cookies are HttpOnly and
    // SameSite=Lax by default).
    useSecureCookies: process.env.NODE_ENV === "production",
    // Rate limits are per visitor, so the visitor's address must be read from
    // a header the platform sets. Better Auth only trusts a header holding a
    // single address; Render's X-Forwarded-For carries several, so every
    // visitor would share one bucket. Render sits behind Cloudflare, which
    // sets the single-value cf-connecting-ip. Behind a different proxy, set
    // CLIENT_IP_HEADER to the header it uses (e.g. x-real-ip).
    ipAddress: {
      ipAddressHeaders: [process.env.CLIENT_IP_HEADER || "cf-connecting-ip"],
    },
  },

  session: {
    // Sessions last 7 days and slide forward at most once a day.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,

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