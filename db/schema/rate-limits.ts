import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Counters for the public endpoints, kept in the database so every server
// instance counts the same visitor together and a restart does not reset them.
// One row per (what, who, time window); old rows are swept away as we go.
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowEnd: timestamp("window_end").notNull(),
  },
  (t) => [index("rate_limits_window_idx").on(t.windowEnd)],
);
