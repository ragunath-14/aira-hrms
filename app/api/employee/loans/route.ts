import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { and } from "drizzle-orm";

import { db } from "@/db";
import { loanRepayments, loans } from "@/db/schema";
import { getActor, serverError, unauthorized } from "@/lib/domain/workplace";

// My Workspace -> Loans: the employee's own loans and advances with every
// instalment taken so far. Only their own are ever returned.
export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return unauthorized();

    const mine = await db
      .select()
      .from(loans)
      .where(and(eq(loans.tenantId, actor.tenant.id), eq(loans.employeeId, actor.employee.id)))
      .orderBy(desc(loans.createdAt));

    const repayments = mine.length
      ? await db
          .select()
          .from(loanRepayments)
          .where(inArray(loanRepayments.loanId, mine.map((loan) => loan.id)))
          .orderBy(desc(loanRepayments.payrollPeriod))
      : [];

    return NextResponse.json(
      mine.map((loan) => ({
        id: loan.id,
        kind: loan.kind,
        principal: loan.principal,
        installments: loan.installments,
        installmentAmount: loan.installmentAmount,
        startPeriod: loan.startPeriod,
        balance: loan.balance,
        status: loan.status,
        note: loan.note,
        repayments: repayments
          .filter((r) => r.loanId === loan.id)
          .map((r) => ({ period: r.payrollPeriod, amount: r.amount })),
      })),
    );
  } catch (error) {
    return serverError("Loans load", error);
  }
}
