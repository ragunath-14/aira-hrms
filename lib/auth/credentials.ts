import { createLocalAccountIssuer } from "@better-auth/core/db";

import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { twoFactor, user as authUsers } from "@/db/schema/auth";
import { memberships } from "@/db/schema/memberships";
import { auth } from "@/lib/auth/server";
import type { Role } from "@/lib/auth/permissions";

// Who may set whose password: only someone ranked strictly above the target.
// The owner's own password is never changed from here.
const RANK: Record<Role, number> = {
  owner: 5,
  admin: 4,
  hr: 3,
  manager: 2,
  employee: 1,
  member: 1,
};

export function canSetPasswordFor(actor: Role, target: Role) {
  return target !== "owner" && RANK[actor] > RANK[target];
}

// Sets (or creates) a login password for an email address. The password is
// hashed by Better Auth (salted scrypt) and only the hash is stored; it is
// never returned, logged or readable afterwards. Existing sessions of that
// user are signed out. Returns true when a new login was created.
export async function setLoginPassword(params: {
  email: string;
  name: string;
  password: string;
}) {
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(params.email, {
    includeAccounts: true,
  });

  if (!found) {
    // Brand-new login: go through Better Auth's own sign-up so the user and
    // credential account are created exactly as a normal sign-up would.
    await auth.api.signUpEmail({
      body: {
        name: params.name,
        email: params.email,
        password: params.password,
      },
    });
    return true;
  }

  const hash = await ctx.password.hash(params.password);
  const hasCredential = found.accounts.some((a) => a.providerId === "credential");

  if (hasCredential) {
    await ctx.internalAdapter.updatePassword(found.user.id, hash);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId: found.user.id,
      providerId: "credential",
      issuer: createLocalAccountIssuer("credential"),
      accountId: found.user.id,
      password: hash,
    });
  }

  await ctx.internalAdapter.deleteUserSessions(found.user.id);
  return !hasCredential;
}


// For someone who lost their authenticator app and recovery codes: removes their
// two-factor secret so they can sign in with just their password again (and
// set it up afresh), and signs them out everywhere. Returns false when the
// person has no login.
export async function resetTwoFactor(email: string) {
  const [login] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(sql`lower(${authUsers.email}) = ${email.toLowerCase()}`)
    .limit(1);

  if (!login) return false;

  await db.delete(twoFactor).where(eq(twoFactor.userId, login.id));
  await db.update(authUsers).set({ twoFactorEnabled: false }).where(eq(authUsers.id, login.id));

  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUserSessions(login.id);

  return true;
}

// A login can belong to several companies. Nobody in one company may change
// the password or two-factor sign-in of someone who also belongs to another:
// that would let them take over the person's access to the other company.
// Those people change their own (or the platform owner helps).
export async function belongsToOtherCompany(userId: string, tenantId: string) {
  const [other] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), ne(memberships.tenantId, tenantId)))
    .limit(1);

  return Boolean(other);
}

export const SHARED_LOGIN_MESSAGE =
  "This person also belongs to another company, so only they can change their sign-in. They can do it from their own account menu.";
