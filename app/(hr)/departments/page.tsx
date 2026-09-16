"use client";

import { useEffect, useState } from "react";

type Department = {
  id: string;
  name: string;
  description: string | null;
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadDepartments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/departments");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to fetch departments",
        );
      }

      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch departments",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  async function handleCreateDepartment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Department name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/departments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create department",
        );
      }

      setDepartments((current) => [...current, data]);

      setName("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create department",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Departments
            </h1>

            <p className="mt-2 text-gray-500">
              Manage departments across your organization.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
            }}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            {showForm ? "Cancel" : "Add Department"}
          </button>
        </div>

        {showForm && (
          <section className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Add Department
            </h2>

            <form
              onSubmit={handleCreateDepartment}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="department-name"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Department Name
                </label>

                <input
                  id="department-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Human Resources"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div>
                <label
                  htmlFor="department-description"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Description
                </label>

                <textarea
                  id="department-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Department description"
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Creating..."
                    : "Create Department"}
                </button>
              </div>
            </form>
          </section>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-semibold text-gray-900">
              Department List
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {departments.length} department
              {departments.length === 1 ? "" : "s"} found
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading departments...
            </div>
          ) : departments.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                No departments found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Create your first department to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-sm text-gray-500">
                    <th className="px-6 py-4 font-medium">
                      Department
                    </th>

                    <th className="px-6 py-4 font-medium">
                      Description
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {departments.map((department) => (
                    <tr
                      key={department.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {department.name}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {department.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}