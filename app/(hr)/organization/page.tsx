"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  logo: string | null;
};

type Department = { id: string; name: string; description: string | null };
type Designation = { id: string; name: string; description: string | null };
type Location = { id: string; name: string; address: string | null; city: string | null; country: string | null };
type Employee = { id: string; firstName: string; lastName: string | null; email: string };

export default function CompanyProfilePage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "departments" | "designations" | "locations">("overview");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [compRes, deptRes, desigRes, locRes, empRes] = await Promise.all([
          fetch("/api/company"),
          fetch("/api/departments"),
          fetch("/api/designations"),
          fetch("/api/locations"),
          fetch("/api/employees"),
        ]);

        if (!compRes.ok) {
          throw new Error("Failed to load company profile");
        }

        setCompany(await compRes.json());

        if (deptRes.ok) setDepartments(await deptRes.json());
        if (desigRes.ok) setDesignations(await desigRes.json());
        if (locRes.ok) setLocations(await locRes.json());
        if (empRes.ok) setEmployees(await empRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500">Loading company profile...</p>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-red-800">Error Loading Profile</h2>
        <p className="mt-2 text-sm text-red-600">{error || "Could not retrieve company profile information."}</p>
        <div className="mt-4">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const companyInitials = company.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-blue-50 opacity-50 blur-3xl"></div>
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Company Logo or Initials */}
            {company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo}
                alt={`${company.name} Logo`}
                className="h-20 w-20 rounded-2xl border border-gray-100 object-contain shadow-sm bg-gray-50 p-2"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-2xl font-bold text-white shadow-md">
                {companyInitials}
              </div>
            )}

            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{company.name}</h1>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Slug: <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-blue-600">{company.slug}</code>
              </p>
              {company.website && (
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  {company.website}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          <div>
            <Link
              href="/settings/company"
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Edit Settings
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Employees</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{employees.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Departments</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{departments.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Designations</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{designations.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Locations</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{locations.length}</p>
        </div>
      </section>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {[
            { id: "overview", label: "Overview" },
            { id: "locations", label: "Locations" },
            { id: "departments", label: "Departments" },
            { id: "designations", label: "Designations" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={[
                "border-b-2 px-1 pb-4 text-sm font-semibold transition",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "overview" && (
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Contact Information</h2>
              <div className="grid gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Email Address</label>
                  <p className="mt-1 text-sm font-medium text-gray-900">{company.email || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Phone Number</label>
                  <p className="mt-1 text-sm font-medium text-gray-900">{company.phone || "—"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-900 border-b pb-3">Address & Location</h2>
              <div className="grid gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase">Street Address</label>
                  <p className="mt-1 text-sm font-medium text-gray-900">{company.address || "—"}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">City</label>
                    <p className="mt-1 text-sm font-medium text-gray-900">{company.city || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">State</label>
                    <p className="mt-1 text-sm font-medium text-gray-900">{company.state || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">Country</label>
                    <p className="mt-1 text-sm font-medium text-gray-900">{company.country || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "locations" && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Locations ({locations.length})</h2>
              <Link href="/locations" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                Manage Locations
              </Link>
            </div>
            {locations.length === 0 ? (
              <p className="text-sm text-gray-500">No locations configured.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {locations.map((loc) => (
                  <div key={loc.id} className="rounded-xl border p-4 hover:border-gray-300 transition shadow-sm bg-gray-50">
                    <p className="font-semibold text-gray-900">{loc.name}</p>
                    <p className="mt-1 text-xs text-gray-500">{loc.address}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {[loc.city, loc.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "departments" && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Departments ({departments.length})</h2>
              <Link href="/departments" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                Manage Departments
              </Link>
            </div>
            {departments.length === 0 ? (
              <p className="text-sm text-gray-500">No departments configured.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((dept) => (
                  <div key={dept.id} className="rounded-xl border p-4 hover:border-gray-300 transition shadow-sm bg-gray-50">
                    <p className="font-semibold text-gray-900">{dept.name}</p>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{dept.description || "No description provided."}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "designations" && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Designations ({designations.length})</h2>
              <Link href="/designations" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                Manage Designations
              </Link>
            </div>
            {designations.length === 0 ? (
              <p className="text-sm text-gray-500">No designations configured.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {designations.map((desig) => (
                  <div key={desig.id} className="rounded-xl border p-4 hover:border-gray-300 transition shadow-sm bg-gray-50">
                    <p className="font-semibold text-gray-900">{desig.name}</p>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{desig.description || "No description provided."}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
