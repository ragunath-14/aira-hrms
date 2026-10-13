"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRoundIcon, PlusIcon, ShieldOffIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorText } from "@/lib/format/error-text";
import { formatDate } from "@/lib/format/date";

type Member = {
  id: string; // membershipId
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  twoFactor?: boolean;
};

const PAGE_SIZE = 10;

// Mirrors lib/credentials.ts: you can set a password only for roles below
// yours, and never for the owner. The server enforces it too.
const RANK: Record<string, number> = { owner: 5, admin: 4, hr: 3, manager: 2, employee: 1, member: 1 };
const canSetPassword = (actor: string, target: string) =>
  target !== "owner" && (RANK[actor] ?? 0) > (RANK[target] ?? 0);

export default function UsersSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);

  // Add Member Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("employee");
  const [newPassword, setNewPassword] = useState("");
  const [savingMember, setSavingMember] = useState(false);

  // Set-password dialog (write-only: passwords can be replaced, never viewed)
  const [myRole, setMyRole] = useState("");
  const [pwMember, setPwMember] = useState<Member | null>(null);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // Loading indicator for row level operations
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [twoFactorTarget, setTwoFactorTarget] = useState<Member | null>(null);

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

    fetch("/api/tenant")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMyRole(d?.membership?.role ?? ""))
      .catch(() => {});
  }, []);

  async function handleResetTwoFactor() {
    const target = twoFactorTarget;
    if (!target) return;

    setTwoFactorTarget(null);

    try {
      const res = await fetch(`/api/memberships/${target.id}/two-factor/reset`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to reset two-factor sign-in");
      }

      toast.success(`Two-factor sign-in removed for ${target.email}`);
      setMembers((current) => current.map((m) => (m.id === target.id ? { ...m, twoFactor: false } : m)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset two-factor sign-in");
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwMember) return;

    if (pw !== pwConfirm) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setSavingPw(true);

      const res = await fetch(`/api/memberships/${pwMember.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to set password",
        );
      }

      toast.success(
        data.created
          ? `Login created for ${pwMember.email}`
          : `Password updated for ${pwMember.email}`,
      );
      setPwMember(null);
      setPw("");
      setPwConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setSavingPw(false);
    }
  }

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
          password: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(errorText(data.error, "Failed to add member"));
      }

      setSuccess(`Successfully added ${newEmail} to the team!`);
      toast.success(`Added ${newEmail} to the team`);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("employee");
      setShowAddForm(false);

      // Reload
      await loadMembers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add member";
      setError(message);
      toast.error(message);
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
        throw new Error(errorText(data.error, "Failed to update role"));
      }

      setSuccess("User role updated successfully!");
      toast.success("Role updated");
      setMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, role } : m))
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update role";
      setError(message);
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRemoveMember() {
    if (!memberToRemove) return;
    const { id: membershipId, email } = memberToRemove;

    try {
      setProcessingId(membershipId);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/memberships/${membershipId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(errorText(data.error, "Failed to remove member"));
      }

      setSuccess(`Removed ${email} from the organization.`);
      toast.success(`Removed ${email}`);
      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to remove member";
      setError(message);
      toast.error(message);
    } finally {
      setProcessingId(null);
      setMemberToRemove(null);
    }
  }

  const roleBadgeClass = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner":
        return "bg-purple-100 text-purple-800 border border-purple-200";
      case "admin":
        return "bg-rose-100 text-rose-800 border border-rose-200";
      case "hr":
        return "bg-sky-100 text-sky-800 border border-sky-200";
      case "manager":
        return "bg-amber-100 text-amber-800 border border-amber-200";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200";
    }
  };

  const pagedMembers = useMemo(
    () => paginate(members, page, PAGE_SIZE),
    [members, page],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Team Members"
          description="Manage user access permissions and company roles."
        />
        <Card className="p-6">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Team Members"
        description="Manage user access permissions and company roles."
        action={
          <Button
            onClick={() => {
              setShowAddForm(true);
              setError("");
              setSuccess("");
            }}
          >
            <PlusIcon />
            Add Member
          </Button>
        }
      />

      {success && (
        <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-5">
          <h2 className="text-lg font-semibold text-foreground">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>

        {members.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No team members yet"
            description="Add a member to give them access to this organization."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium text-foreground">
                      {member.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      {member.role === "owner" ? (
                        <Badge className={roleBadgeClass(member.role)}>
                          Owner
                        </Badge>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(value) =>
                            handleRoleChange(member.id, value ?? member.role)
                          }
                        >
                          <SelectTrigger
                            disabled={processingId === member.id}
                            size="sm"
                            className={roleBadgeClass(member.role)}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="hr">HR Partner</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      {canSetPassword(myRole, member.role) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPw("");
                            setPwConfirm("");
                            setPwMember(member);
                          }}
                        >
                          <KeyRoundIcon /> Set password
                        </Button>
                      )}
                      {member.twoFactor && canSetPassword(myRole, member.role) && (
                        <Button variant="outline" size="sm" onClick={() => setTwoFactorTarget(member)}>
                          <ShieldOffIcon /> Reset 2FA
                        </Button>
                      )}
                      {member.role !== "owner" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={processingId === member.id}
                          onClick={() => setMemberToRemove(member)}
                        >
                          {processingId === member.id
                            ? "Removing…"
                            : "Remove"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={members.length}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
            <DialogDescription>
              Invite a new user to join this organization.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <Label className="mb-1.5">Email Address *</Label>
              <Input
                required
                type="email"
                placeholder="email@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1.5">Full Name</Label>
              <Input
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1.5">Password (optional)</Label>
              <Input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                placeholder="At least 12 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Gives them a login right away (their email is the user ID). Leave blank if they will sign up themselves. The password is stored hashed and cannot be viewed later, only replaced.
              </p>
            </div>

            <div>
              <Label className="mb-1.5">Role</Label>
              <Select
                value={newRole}
                onValueChange={(value) => setNewRole(value ?? "employee")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="hr">HR Partner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingMember}>
                {savingMember ? "Adding…" : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pwMember !== null} onOpenChange={(open) => !open && setPwMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set password</DialogTitle>
            <DialogDescription>
              Choose a new password for {pwMember?.email}. It replaces the current one, signs them out everywhere, and cannot be viewed afterwards.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <Label htmlFor="pw-new" className="mb-1.5">New password</Label>
              <Input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">At least 12 characters.</p>
            </div>
            <div>
              <Label htmlFor="pw-confirm" className="mb-1.5">Confirm password</Label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwMember(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPw || pw.length < 12}>
                {savingPw ? "Saving…" : "Set password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!twoFactorTarget}
        onOpenChange={(open) => {
          if (!open) setTwoFactorTarget(null);
        }}
        title="Reset two-factor sign-in?"
        description={
          twoFactorTarget
            ? `${twoFactorTarget.email} will be signed out everywhere and can sign in with just their password until they set up two-factor again. Use this when they lost their phone and recovery codes.`
            : undefined
        }
        confirmLabel="Reset 2FA"
        destructive={false}
        onConfirm={handleResetTwoFactor}
      />

      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        title="Remove team member"
        description={
          memberToRemove
            ? `Are you sure you want to remove ${memberToRemove.email} from the organization?`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        loading={processingId === memberToRemove?.id}
        onConfirm={handleRemoveMember}
      />
    </div>
  );
}
