import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Opening a Neon WebSocket connection costs 1-2 s. Keep connections alive
// (the default drops them after 10 s idle) and reuse one pool across hot
// reloads so requests almost never pay the handshake.
const globalForDb = globalThis as unknown as { __dbPool?: Pool };

const pool =
  globalForDb.__dbPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
    // Neon closes connections after about five idle minutes (when its compute
    // suspends). Dropping idle connections a little sooner means a request never
    // picks up one that Neon has already closed.
    idleTimeoutMillis: 4 * 60 * 1000,
  });

// An idle connection dropped by Neon would otherwise raise an unhandled
// "error" event and crash the process.
if (!globalForDb.__dbPool) {
  pool.on("error", (err: Error) => {
    console.error("Database pool error:", err.message);
  });
}

globalForDb.__dbPool = pool;

// A connection can still be closed from the other end between being checked in
// and used again (Neon suspending, a network blip), and the first query on it
// fails with "Connection terminated unexpectedly" before anything reaches the
// database. Such a query is retried on another connection instead of becoming an
// error page. Statements inside a transaction are not affected: those run on
// their own client, not through pool.query.
const DROPPED = /connection terminated|connection ended unexpectedly|ECONNRESET|socket hang up/i;
const poolQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown;

const patchable = pool as unknown as { query: (...args: unknown[]) => unknown; __retrying?: boolean };

// A hot reload re-runs this file against the same pool: wrap it only once.
if (!patchable.__retrying) {
  patchable.__retrying = true;
  patchable.query = (...args: unknown[]) => {
    const attempt = (tries: number): unknown => {
      const result = poolQuery(...args);

      // Callback-style calls return nothing to retry.
      if (!result || typeof (result as Promise<unknown>).then !== "function") return result;

      return (result as Promise<unknown>).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);

        if (tries < 3 && DROPPED.test(message)) return attempt(tries + 1);

        throw error;
      });
    };

    return attempt(1);
  };
}

export const db = drizzle(pool);

// Opens the first connection and keeps the pool and the Neon compute awake.
export function warmDatabase() {
  // Parallel pings open several connections at once, so queries that fan out
  // (reports, dashboards) don't each pay a fresh handshake.
  const ping = () => {
    for (let i = 0; i < 5; i++) {
      pool.query("select pg_sleep(0.05)").catch(() => {});
    }
  };

  ping();

  // The repeating ping keeps Neon's compute from auto-suspending, which uses up
  // Neon's free compute hours around the clock. It is on in development and
  // opt-in in production (DB_KEEP_WARM=true) where cold starts are acceptable.
  const keepWarm =
    process.env.NODE_ENV === "production"
      ? process.env.DB_KEEP_WARM === "true"
      : process.env.DB_KEEP_WARM !== "false";

  if (keepWarm) {
    const timer = setInterval(ping, 30_000);
    timer.unref?.();
  }
}
