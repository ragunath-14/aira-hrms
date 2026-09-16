"use client";

import { useEffect, useState } from "react";

type PayrollRecord = {
  id: string;
  employeeId: string;
  payrollPeriod: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  status: string;
};

type Payslip = {
  id: string;
  employeeId: string;
  payrollRecordId: string;
  payrollPeriod: string;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  generatedAt: string;
};

export default function PayrollPage() {
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPayroll() {
      try {
        const [payrollResponse, payslipResponse] =
          await Promise.all([
            fetch("/api/payroll"),
            fetch("/api/payslips"),
          ]);

        if (payrollResponse.ok) {
          const payrollData = await payrollResponse.json();
          setPayroll(
            Array.isArray(payrollData) ? payrollData : [],
          );
        }

        if (payslipResponse.ok) {
          const payslipData = await payslipResponse.json();
          setPayslips(
            Array.isArray(payslipData) ? payslipData : [],
          );
        }
      } finally {
        setLoading(false);
      }
    }

    loadPayroll();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Payroll
          </h1>

          <p className="mt-4 text-gray-500">
            Loading payroll...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Payroll
          </h1>

          <p className="mt-2 text-gray-500">
            Payroll records and employee payslips.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <SummaryCard
            title="Payroll Records"
            value={payroll.length}
          />

          <SummaryCard
            title="Payslips"
            value={payslips.length}
          />

          <SummaryCard
            title="Processed"
            value={
              payroll.filter(
                (record) => record.status === "processed",
              ).length
            }
          />
        </div>

        <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Payroll Records
          </h2>

          {payroll.length === 0 ? (
            <p className="mt-5 text-gray-500">
              No payroll records found.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-sm text-gray-500">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">Period</th>
                    <th className="pb-3">Basic Salary</th>
                    <th className="pb-3">Allowances</th>
                    <th className="pb-3">Deductions</th>
                    <th className="pb-3">Net Salary</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {payroll.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b last:border-0"
                    >
                      <td className="py-4 text-sm">
                        {record.employeeId}
                      </td>

                      <td className="py-4">
                        {record.payrollPeriod}
                      </td>

                      <td className="py-4">
                        ₹{record.basicSalary}
                      </td>

                      <td className="py-4">
                        ₹{record.totalAllowances}
                      </td>

                      <td className="py-4">
                        ₹{record.totalDeductions}
                      </td>

                      <td className="py-4 font-semibold">
                        ₹{record.netSalary}
                      </td>

                      <td className="py-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Payslips
          </h2>

          {payslips.length === 0 ? (
            <p className="mt-5 text-gray-500">
              No payslips found.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {payslips.map((payslip) => (
                <div
                  key={payslip.id}
                  className="rounded-lg border p-5"
                >
                  <p className="text-sm text-gray-500">
                    Payroll Period
                  </p>

                  <p className="mt-1 font-semibold">
                    {payslip.payrollPeriod}
                  </p>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Basic</span>
                      <span>
                        ₹{payslip.basicSalary}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Allowances</span>
                      <span>
                        ₹{payslip.totalAllowances}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Deductions</span>
                      <span>
                        ₹{payslip.totalDeductions}
                      </span>
                    </div>

                    <div className="flex justify-between border-t pt-2 font-bold">
                      <span>Net Salary</span>
                      <span>
                        ₹{payslip.netSalary}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-400">
                    Generated:{" "}
                    {new Date(
                      payslip.generatedAt,
                    ).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}