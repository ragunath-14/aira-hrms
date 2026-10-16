import { sql } from "drizzle-orm";

import { db } from "@/db";

// Limits for the public careers endpoints and the API, which have no login to
// key on. Counted in the database so every server instance counts the same
// visitor together and a restart does not reset anything. If the database is
// unreachable the check falls back to a per-instance counter rather than
// letting everything through or blocking everyone.

const memory = new Map<string, number[]>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (memory.get(key) ?? []).filter((at) => now - at < windowMs);

  if (recent.length >= limit) {
    memory.set(key, recent);
    return false;
  }

  recent.push(now);
  memory.set(key, recent);

  if (memory.size > 5000) {
    for (const [k, list] of memory) {
      if (list.every((at) => now - at >= windowMs)) memory.delete(k);
    }
  }

  return true;
}

// The visitor's address as the host reports it (Render puts the real client
// in cf-connecting-ip).
export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return request.headers.get("cf-connecting-ip") ?? forwarded ?? "unknown";
}

// True when `who` is still within `limit` calls per `windowMs` for this bucket.
// Fixed windows: simple, and one row per window.
export async function withinLimitFor(bucket: string, who: string, limit: number, windowMs: number) {
  const window = Math.floor(Date.now() / windowMs);
  const key = `${bucket}|${who}|${window}`;
  const windowEnd = new Date((window + 1) * windowMs);

  try {
    const result = await db.execute(sql`
      insert into rate_limits (key, count, window_end)
      values (${key}, 1, ${windowEnd})
      on conflict (key) do update set count = rate_limits.count + 1
      returning count
    `);

    const count = Number((result.rows[0] as { count: number } | undefined)?.count ?? 1);

    // Sweep old windows now and then so the table stays small.
    if (Math.random() < 0.01) {
      void db.execute(sql`delete from rate_limits where window_end < now() - interval '1 hour'`).catch(() => {});
    }

    return count <= limit;
  } catch (error) {
    console.error("[rate limit] database unavailable, using the local counter:", error instanceof Error ? error.message : error);

    return memoryLimit(key, limit, windowMs);
  }
}

// How many times `who` has been counted in the current window, without
// counting this call. Used to refuse callers who keep failing.
export async function usedFor(bucket: string, who: string, windowMs: number) {
  const key = `${bucket}|${who}|${Math.floor(Date.now() / windowMs)}`;

  try {
    const result = await db.execute(sql`select count from rate_limits where key = ${key}`);

    return Number((result.rows[0] as { count: number } | undefined)?.count ?? 0);
  } catch {
    return 0;
  }
}

export function withinLimit(bucket: string, request: Request, limit: number, windowMs: number) {
  return withinLimitFor(bucket, clientKey(request), limit, windowMs);
}
