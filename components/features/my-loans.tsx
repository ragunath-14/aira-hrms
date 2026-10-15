"use client";

import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/format/currency";

type MyLoan = {
  id: string;
  kind: "loan" | "advance";
  principal: string;
  installments: number;
  installmentAmount: string;
  startPeriod: string;
  balance: string;
  status: "active" | "closed";
  note: string | null;
  repayments: { period: string; amount: string }[];
};

// The signed-in employee's own loans and advances. Renders nothing when there
// are none, so most people never see it.
export function MyLoans() {
  const [loans, setLoans] = useState<MyLoan[]>([]);

  useEffect(() => {
    fetch("/api/employee/loans")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setLoans(Array.isArray(data) ? data : []))
      .catch(() => setLoans([]));
  }, []);

  if (loans.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loans &amp; advances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loans.map((loan) => (
          <div key={loan.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold capitalize text-foreground">
                {loan.kind} of {formatINR(loan.principal)}
              </p>
              <StatusBadge status={loan.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatINR(loan.installmentAmount)} a month for {loan.installments} month
              {loan.installments === 1 ? "" : "s"}, from {loan.startPeriod}. Still to pay:{" "}
              <strong className="text-foreground">{formatINR(loan.balance)}</strong>
            </p>
            {loan.note && <p className="mt-1 text-xs text-muted-foreground">{loan.note}</p>}
            {loan.repayments.length > 0 && (
              <ul className="mt-3 divide-y text-sm">
                {loan.repayments.map((r) => (
                  <li key={r.period} className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Taken from {r.period} pay</span>
                    <span>{formatINR(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
