import { createLocalAccountIssuer } from "@better-auth/core/db";

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
