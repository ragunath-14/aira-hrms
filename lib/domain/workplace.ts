import { NextResponse } from "next/server";

import { getOrCreateCurrentEmployee } from "@/lib/auth/authorization";

export const HR_ROLES = ["owner", "admin", "hr"];

// Signed-in user with their own employee record, plus whether they act as HR.
export async function getActor(request: Request) {
  const auth = await getOrCreateCurrentEmployee(request);

  if (!auth) {
    return null;
  }

  return { ...auth, isHr: HR_ROLES.includes(auth.membership.role) };
}

export type Actor = NonNullable<Awaited<ReturnType<typeof getActor>>>;

export const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

export const notFound = (what: string) =>
  NextResponse.json({ error: `${what} not found` }, { status: 404 });

export const invalid = (error: unknown) =>
  NextResponse.json({ error }, { status: 400 });

export const serverError = (label: string, error: unknown) => {
  console.error(`${label}:`, error);
  return NextResponse.json({ error: `${label} failed` }, { status: 500 });
};
