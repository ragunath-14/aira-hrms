"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  dateOfJoining: string | null;
  departmentId: string | null;
  designationId: string | null;
  locationId: string | null;
  managerId: string | null;
  status: string;
};

type Department = { id: string; name: string };
type Designation = { id: string; name: string };
type Location = { id: string; name: string };

const emptyForm = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfJoining: "",
  departmentId: "",
  designationId: "",
  locationId: "",
  managerId: "",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function loadLookups() {
    const [deptRes, desigRes, locRes] = await Promise.all([
      fetch("/api/departments"),
      fetch("/api/designations"),
      fetch("/api/locations"),
    ]);
    if (deptRes.ok) setDepartments(await deptRes.json());
    if (desigRes.ok) setDesignations(await desigRes.json());
    if (locRes.ok) setLocations(await locRes.json());
  }

  async function loadEmployees() {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const query = params.toString();
      const response = await fetch(`/api/employees${query ? `?${query}` : ""}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch employees");
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadEmployees(), 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  async function createEmployee(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode: form.employeeCode.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          dateOfJoining: form.dateOfJoining || null,
          departmentId: form.departmentId || null,
          designationId: form.designationId || null,
          locationId: form.locationId || null,
          managerId: form.managerId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create employee");
      setShowAddForm(false);
      setForm(emptyForm);
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (emp: Employee) =>
    `${emp.firstName}${emp.lastName ? " " + emp.lastName : ""}`;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          <p className="mt-2 text-gray-500">Manage your organisation&apos;s employees.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAddForm(true); setError(""); }}
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Add Employee
        </button>
      </div>

      {/* Search / filter */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <label htmlFor="employee-search" className="mb-2 block text-sm font-medium text-gray-700">Search employees</label>
            <input
              id="employee-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or employee code…"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
            />
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="employee-status" className="mb-2 block text-sm font-medium text-gray-700">Status</label>
            <select
              id="employee-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-gray-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>
      </section>

      {/* Add Employee Form */}
      {showAddForm && (
        <section className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add Employee</h2>
              <p className="mt-1 text-sm text-gray-500">Create a new employee profile.</p>
            </div>
            <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
          <form onSubmit={createEmployee} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Employee Code *</label>
              <input required placeholder="EMP001" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} className="w-full rounded-lg border px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">First Name *</label>
              <input required placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded-lg border px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Last Name</label>
              <input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded-lg border px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Email *</label>
              <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Phone</label>
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Date of Joining</label>
              <input type="date" value={form.dateOfJoining} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} className="w-full rounded-lg border px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Department</label>
              <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="w-full rounded-lg border bg-white px-4 py-2.5 text-sm">
                <option value="">— Select Department —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Designation</label>
              <select value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })} className="w-full rounded-lg border bg-white px-4 py-2.5 text-sm">
                <option value="">— Select Designation —</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Location</label>
              <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className="w-full rounded-lg border bg-white px-4 py-2.5 text-sm">
                <option value="">— Select Location —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Manager</label>
              <select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })} className="w-full rounded-lg border bg-white px-4 py-2.5 text-sm">
                <option value="">— No Manager —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{nameOf(e)}</option>)}
              </select>
            </div>
            {error && <p className="lg:col-span-3 text-sm text-red-600">{error}</p>}
            <div className="lg:col-span-3 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                {saving ? "Saving…" : "Save Employee"}
              </button>
            </div>
          </form>
        </section>
      )}

      {error && !showAddForm && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Employee list */}
      <section className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="text-xl font-semibold text-gray-900">Employee List</h2>
          <p className="mt-1 text-sm text-gray-500">{employees.length} employee{employees.length !== 1 ? "s" : ""} found</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading employees…</div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900">No employees found</h3>
            <p className="mt-2 text-sm text-gray-500">Try changing your search or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50 text-sm text-gray-500">
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">Joining Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{nameOf(employee)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{employee.employeeCode}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{employee.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{employee.phone ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${employee.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/employees/${employee.id}`}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        View Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
