"use client";

import { useEffect, useState } from "react";

type Member = {
  id: string; // membershipId
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export default function UsersSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Add Member Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("employee");
  const [savingMember, setSavingMember] = useState(false);

  // Loading indicator for row level operations
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadMembers() {
    try {
      setLoading(true);
      const res = await fetch("/api/memberships");
      if (!res.ok) {
        throw new Error("Failed to load team members");
      }
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      setSavingMember(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim() || undefined,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add member");
      }

      setSuccess(`Successfully added ${newEmail} to the team!`);
      setNewEmail("");
      setNewName("");
      setNewRole("employee");
      setShowAddForm(false);
      
      // Reload
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSavingMember(false);
    }
  }

  async function handleRoleChange(membershipId: string, role: string) {
    try {
      setProcessingId(membershipId);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/memberships/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      setSuccess("User role updated successfully!");
      setMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, role } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRemoveMember(membershipId: string, email: string) {
    if (!confirm(`Are you sure you want to remove ${email} from the organization?`)) {
      return;
    }

    try {
      setProcessingId(membershipId);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/memberships/${membershipId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove member");
      }

      setSuccess(`Removed ${email} from the organization.`);
      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setProcessingId(null);
    }
  }

  const roleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "admin":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "hr":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "manager":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500">Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 font-sans">Team Members</h1>
          <p className="mt-1.5 text-sm text-gray-500">Manage user access permissions and company roles.</p>
        </div>
        <div>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setError("");
              setSuccess("");
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 shadow-sm"
          >
            {showAddForm ? "Cancel Add" : "Add Member"}
          </button>
        </div>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm">
          {error}
        </div>
      )}

      {/* Add Member Drawer Form */}
      {showAddForm && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Add New Member</h2>
          <form onSubmit={handleAddMember} className="grid gap-6 sm:grid-cols-3 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Email Address *</label>
              <input
                required
                type="email"
                placeholder="email@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Role</label>
              <div className="flex gap-3">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="hr">HR Partner</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Employee</option>
                  <option value="member">Member</option>
                </select>
                <button
                  disabled={savingMember}
                  type="submit"
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-blue-400 shadow-sm"
                >
                  Add
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Members List Table */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined On</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-6 py-4 font-semibold text-gray-900">{member.name}</td>
                  <td className="px-6 py-4">{member.email}</td>
                  <td className="px-6 py-4">
                    {member.role === "owner" ? (
                      <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold shadow-sm bg-purple-50 text-purple-700 border-purple-200">
                        Owner
                      </span>
                    ) : (
                      <div className="relative inline-block w-40">
                        <select
                          disabled={processingId === member.id}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className={[
                            "w-full rounded-lg border px-2 py-1 text-xs font-semibold outline-none transition bg-white shadow-sm cursor-pointer",
                            roleBadgeColor(member.role),
                          ].join(" ")}
                        >
                          <option value="admin">Admin</option>
                          <option value="hr">HR Partner</option>
                          <option value="manager">Manager</option>
                          <option value="employee">Employee</option>
                          <option value="member">Member</option>
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(member.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {member.role !== "owner" && (
                      <button
                        disabled={processingId === member.id}
                        onClick={() => handleRemoveMember(member.id, member.email)}
                        className="rounded-lg border border-red-200 hover:bg-red-50 text-xs font-semibold text-red-600 px-3 py-1.5 transition disabled:opacity-50"
                      >
                        {processingId === member.id ? "Removing..." : "Remove"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
