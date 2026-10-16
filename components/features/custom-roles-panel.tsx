"use client";

import { useCallback, useEffect, useState } from "react";
import { PencilIcon, PlusIcon, ShieldIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { selectClass } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACTIONS,
  ACTION_LABELS,
  BASE_ROLES,
  MODULES,
  type Action,
  type CustomRolePermissions,
  type ModuleId,
} from "@/lib/auth/custom-roles";
import { errorText } from "@/lib/format/error-text";

type CustomRole = {
  id: string;
  name: string;
  baseRole: string;
  permissions: CustomRolePermissions;
  members: number;
};

const everything = (): CustomRolePermissions =>
  Object.fromEntries(MODULES.map((m) => [m.id, [...ACTIONS]])) as CustomRolePermissions;

const readOnly = (): CustomRolePermissions =>
  Object.fromEntries(MODULES.map((m) => [m.id, ["view"]])) as CustomRolePermissions;

const baseLabel = (id: string) => BASE_ROLES.find((r) => r.id === id)?.label ?? id;

// A one-line description of what a role can do.
function summary(permissions: CustomRolePermissions) {
  const full: string[] = [];
  const viewOnly: string[] = [];

  for (const area of MODULES) {
    const actions = permissions[area.id] ?? [];

    if (actions.length === ACTIONS.length) full.push(area.label.split(" & ")[0].split(",")[0]);
    else if (actions.length > 0) viewOnly.push(`${area.label.split(" & ")[0].split(",")[0]} (${actions.map((a) => ACTION_LABELS[a].toLowerCase()).join("/")})`);
  }

  const parts = [full.length ? `Full: ${full.join(", ")}` : "", viewOnly.length ? `Limited: ${viewOnly.join(", ")}` : ""].filter(Boolean);

  return parts.join(" · ") || "No access to anything";
}

// The company's own roles: a name on top of Admin, HR Partner or Manager that
// takes access away, area by area and action by action.
export function CustomRolesPanel() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [name, setName] = useState("");
  const [baseRole, setBaseRole] = useState("hr");
  const [permissions, setPermissions] = useState<CustomRolePermissions>(everything());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [removing, setRemoving] = useState<CustomRole | null>(null);

  const load = useCallback(async () => {
    try {
      const [res, tenantRes] = await Promise.all([fetch("/api/custom-roles"), fetch("/api/tenant")]);
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to load roles"));

      setRoles(data.roles);
      const tenant = await tenantRes.json().catch(() => null);
      setCanEdit(["owner", "admin"].includes(tenant?.membership?.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setName("");
    setBaseRole("hr");
    setPermissions(everything());
    setFormError("");
    setOpen(true);
  }

  function openEdit(role: CustomRole) {
    setEditing(role);
    setName(role.name);
    setBaseRole(role.baseRole);
    setPermissions(role.permissions);
    setFormError("");
    setOpen(true);
  }

  function toggle(area: ModuleId, action: Action, on: boolean) {
    const current = new Set(permissions[area] ?? []);

    if (on) {
      current.add(action);
      // Changing something implies being able to see it.
      if (action !== "view") current.add("view");
    } else {
      current.delete(action);
      // Not seeing it means not changing it either.
      if (action === "view") current.clear();
    }

    setPermissions({ ...permissions, [area]: ACTIONS.filter((a) => current.has(a)) });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch(editing ? `/api/custom-roles/${editing.id}` : "/api/custom-roles", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), baseRole, permissions }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to save the role"));

      toast.success(editing ? "Role updated" : "Role created");
      setOpen(false);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save the role";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: CustomRole) {
    try {
      const res = await fetch(`/api/custom-roles/${role.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(errorText(data.error, "Failed to delete the role"));

      toast.success("Role deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the role");
    }
  }

  return (
    <Card className="mb-6 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Your company&apos;s roles</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Create a role such as &ldquo;Payroll clerk&rdquo; or &ldquo;Recruiter&rdquo;: start from Admin, HR Partner or
            Manager and take away what that person should not use, area by area and action by action. A role can only
            remove access, never add to it.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNew}>
            <PlusIcon /> New role
          </Button>
        )}
      </div>

      {error && <p className="px-6 py-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-2 p-6">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : roles.length === 0 ? (
        <div className="flex items-center gap-3 px-6 py-6 text-sm text-muted-foreground">
          <ShieldIcon className="size-5" />
          No company roles yet. Everyone uses the built-in roles below.
        </div>
      ) : (
        <ul className="divide-y">
          {roles.map((role) => (
            <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {role.name}{" "}
                  <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Based on {baseLabel(role.baseRole)}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{summary(role.permissions)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {role.members === 0 ? "Nobody has this role yet" : `${role.members} ${role.members === 1 ? "person" : "people"}`}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                    <PencilIcon /> Edit
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${role.name}`} onClick={() => setRemoving(role)}>
                    <Trash2Icon />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "New role"}</DialogTitle>
            <DialogDescription>
              People with this role act as the base role, minus whatever you untick below. Assign it to people under
              Settings → Users.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cr-name" className="mb-1.5">Role name</Label>
                <Input id="cr-name" required maxLength={40} placeholder="e.g. Payroll clerk" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cr-base" className="mb-1.5">Starts from</Label>
                <select id="cr-base" className={selectClass} value={baseRole} onChange={(e) => setBaseRole(e.target.value)}>
                  {BASE_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">What this role can do</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPermissions(everything())}>Allow everything</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPermissions(readOnly())}>View only</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPermissions({})}>Clear</Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2 font-semibold">Area</th>
                    {ACTIONS.map((action) => (
                      <th key={action} className="w-20 px-2 py-2 text-center font-semibold">{ACTION_LABELS[action]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((area) => (
                    <tr key={area.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">{area.label}</p>
                        <p className="text-xs text-muted-foreground">{area.hint}</p>
                      </td>
                      {ACTIONS.map((action) => (
                        <td key={action} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input accent-primary"
                            aria-label={`${ACTION_LABELS[action]} ${area.label}`}
                            checked={(permissions[area.id] ?? []).includes(action)}
                            onChange={(e) => toggle(area.id, action, e.target.checked)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save role" : "Create role"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this role?"
        description={removing ? `"${removing.name}" will be removed. This only works when nobody has it.` : undefined}
        confirmLabel="Delete"
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) void remove(target);
        }}
      />
    </Card>
  );
}
