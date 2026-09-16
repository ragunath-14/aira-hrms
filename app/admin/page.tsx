"use client";

import { useEffect, useState } from "react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  createdAt: string;
  memberCount: number;
};

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/tenants");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Access denied");
        }

        setTenants(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900">Platform Admin</h1>
        <p className="mt-2 text-gray-500">All tenants on this deployment.</p>

        {loading && (
          <p className="mt-6 text-sm text-gray-500">Loading…</p>
        )}

        {error && !loading && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {tenants && (
          <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50 text-sm text-gray-500">
                  <th className="px-6 py-4 font-medium">Tenant</th>
                  <th className="px-6 py-4 font-medium">Slug</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Members</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b last:border-0">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {tenant.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tenant.slug}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tenant.email ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tenant.memberCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
