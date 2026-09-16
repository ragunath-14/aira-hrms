"use client";

import { useEffect, useState } from "react";

type SalaryStructure = {
  id: string;
  employeeId: string;
  basicSalary: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
};

type SalaryComponent = {
  id: string;
  name: string;
  type: string;
  amount: string;
};

export default function SalaryPage() {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSalaryData() {
      try {
        const [structureResponse, componentResponse] =
          await Promise.all([
            fetch("/api/salary-structures"),
            fetch("/api/salary-components"),
          ]);

        if (structureResponse.ok) {
          const data = await structureResponse.json();

          setStructures(
            Array.isArray(data) ? data : [],
          );
        }

        if (componentResponse.ok) {
          const data = await componentResponse.json();

          setComponents(
            Array.isArray(data) ? data : [],
          );
        }
      } finally {
        setLoading(false);
      }
    }

    loadSalaryData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Salary Management
          </h1>

          <p className="mt-4 text-gray-500">
            Loading salary information...
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
            Salary Management
          </h1>

          <p className="mt-2 text-gray-500">
            Basic salary structures and salary components.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <SummaryCard
            title="Salary Structures"
            value={structures.length}
          />

          <SummaryCard
            title="Salary Components"
            value={components.length}
          />
        </div>

        <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Basic Salary
          </h2>

          {structures.length === 0 ? (
            <p className="mt-5 text-gray-500">
              No salary structures found.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-sm text-gray-500">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">Basic Salary</th>
                    <th className="pb-3">Effective From</th>
                    <th className="pb-3">Effective To</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {structures.map((structure) => (
                    <tr
                      key={structure.id}
                      className="border-b last:border-0"
                    >
                      <td className="py-4 text-sm">
                        {structure.employeeId}
                      </td>

                      <td className="py-4 font-semibold">
                        ₹{structure.basicSalary}
                      </td>

                      <td className="py-4">
                        {structure.effectiveFrom}
                      </td>

                      <td className="py-4">
                        {structure.effectiveTo || "Current"}
                      </td>

                      <td className="py-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                          {structure.status}
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
            Salary Components
          </h2>

          {components.length === 0 ? (
            <p className="mt-5 text-gray-500">
              No salary components found.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {components.map((component) => (
                <div
                  key={component.id}
                  className="rounded-lg border p-5"
                >
                  <h3 className="font-semibold text-gray-900">
                    {component.name}
                  </h3>

                  <p className="mt-2 text-sm text-gray-500">
                    Type: {component.type}
                  </p>

                  <p className="mt-3 text-2xl font-bold text-gray-900">
                    ₹{component.amount}
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