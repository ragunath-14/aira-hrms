import { and, eq, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { employees } from "@/db/schema/employees";

// Employee code and work email must each be unique inside a company
// (case-insensitive). Returns a message when one is already taken.
export async function findEmployeeDuplicate(params: {
  tenantId: string;
  employeeCode?: string;
  email?: string;
  excludeId?: string;
}) {
  const matches = [];

  if (params.employeeCode) {
    matches.push(sql`lower(${employees.employeeCode}) = ${params.employeeCode.toLowerCase()}`);
  }

  if (params.email) {
    matches.push(sql`lower(${employees.email}) = ${params.email.toLowerCase()}`);
  }

  if (matches.length === 0) return null;

  const [row] = await db
    .select({ employeeCode: employees.employeeCode, email: employees.email })
    .from(employees)
    .where(
      and(
        eq(employees.tenantId, params.tenantId),
        or(...matches),
        params.excludeId ? ne(employees.id, params.excludeId) : undefined,
      ),
    )
    .limit(1);

  if (!row) return null;

  return params.employeeCode &&
    row.employeeCode.toLowerCase() === params.employeeCode.toLowerCase()
    ? `Employee code ${row.employeeCode} is already in use`
    : "An employee with this email already exists";
}
