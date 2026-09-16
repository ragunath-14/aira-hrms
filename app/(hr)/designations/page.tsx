"use client";

import { useEffect, useState } from "react";

type Designation = {
  id: string;
  name: string;
  description: string | null;
};

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadDesignations() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/designations");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to fetch designations",
        );
      }

      setDesignations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch designations",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDesignations();
  }, []);

  async function handleCreateDesignation(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Designation name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/designations", {
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
          data.error || "Failed to create designation",
        );
      }

      setDesignations((current) => [...current, data]);

      setName("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create designation",
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
              Designations
            </h1>

            <p className="mt-2 text-gray-500">
              Manage employee designations across your organization.
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
            {showForm ? "Cancel" : "Add Designation"}
          </button>
        </div>

        {showForm && (
          <section className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Add Designation
            </h2>

            <form
              onSubmit={handleCreateDesignation}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="designation-name"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Designation Name
                </label>

                <input
                  id="designation-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. HR Manager"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div>
                <label
                  htmlFor="designation-description"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Description
                </label>

                <textarea
                  id="designation-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Designation description"
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
                    : "Create Designation"}
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
              Designation List
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {designations.length} designation
              {designations.length === 1 ? "" : "s"} found
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading designations...
            </div>
          ) : designations.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                No designations found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Create your first designation to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-sm text-gray-500">
                    <th className="px-6 py-4 font-medium">
                      Designation
                    </th>

                    <th className="px-6 py-4 font-medium">
                      Description
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {designations.map((designation) => (
                    <tr
                      key={designation.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {designation.name}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {designation.description || "—"}
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