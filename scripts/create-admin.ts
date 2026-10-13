// Creates (or promotes) the first real administrator for a deployment, so a
// production database never needs the public demo accounts.
//
//   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a-long-passphrase' \
//   ADMIN_NAME='Your Name' COMPANY_NAME='Your Company' npm run db:create-admin
//
// The login ID is the email address. The password is hashed by Better Auth
// (salted scrypt) and only the hash is stored in the "account" table; the
// plain text is never written to the database, logs or source control.
import { eq } from "drizzle-orm";

import { db } from "@/db/index";
import { auth } from "@/lib/auth/server";
import { user as authUsers } from "@/db/schema/auth";
import { users } from "@/db/schema/users";
import { tenants } from "@/db/schema/tenants";
import { memberships } from "@/db/schema/memberships";

async function main() {
  // Used by the Render build (`npm run db:bootstrap-admin`): do nothing unless
  // the admin variables are set, and never touch an existing login.
  if (
    process.argv.includes("--if-configured") &&
    (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)
  ) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping admin bootstrap.");
    return;
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  const company = process.env.COMPANY_NAME?.trim() || `${name}'s Company`;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error("ADMIN_PASSWORD must be 12-128 characters.");
  }

  const [existingAuth] = await db
    .select()
    .from(authUsers)
    .where(eq(authUsers.email, email))
    .limit(1);

  if (!existingAuth) {
    await auth.api.signUpEmail({ body: { name, email, password } });
    console.log(`Created login for ${email} (password stored as a hash).`);
  } else {
    console.log(`Login for ${email} already exists; password left unchanged.`);
  }

  let [appUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!appUser) {
    [appUser] = await db.insert(users).values({ name, email }).returning();
  }

  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, appUser.id))
    .limit(1);

  if (!membership) {
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: company,
        slug: `company-${appUser.id}`,
        email,
      })
      .returning();

    await db.insert(memberships).values({
      userId: appUser.id,
      tenantId: tenant.id,
      role: "owner",
    });
    console.log(`Created company "${company}" with ${email} as owner.`);
  }

  if (process.argv.includes("--super-admin") && !appUser.isSuperAdmin) {
    await db
      .update(users)
      .set({ isSuperAdmin: true })
      .where(eq(users.id, appUser.id));
    console.log("Granted platform super-admin.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
