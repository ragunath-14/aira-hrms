import { and, eq, ne, sql } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";

import { db } from "@/db";

// True when another row in the same company already has this name, ignoring
// case and surrounding spaces. Used for departments and designations.
export async function nameTaken(params: {
  table: AnyPgTable;
  nameColumn: AnyPgColumn;
  tenantColumn: AnyPgColumn;
  idColumn: AnyPgColumn;
  tenantId: string;
  name: string;
  excludeId?: string;
}) {
  const [row] = await db
    .select({ id: params.idColumn })
    .from(params.table)
    .where(
      and(
        eq(params.tenantColumn, params.tenantId),
        sql`lower(trim(${params.nameColumn})) = ${params.name.trim().toLowerCase()}`,
        params.excludeId ? ne(params.idColumn, params.excludeId) : undefined,
      ),
    )
    .limit(1);

  return !!row;
}
