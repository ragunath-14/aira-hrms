"use client";

import { useEffect, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { CustomRolesPanel } from "@/components/features/custom-roles-panel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorText } from "@/lib/format/error-text";

type PermissionInfo = {
  key: string;
  name: string;
  description: string | null;
};

type RoleInfo = {
  key: string;
  name: string;
  permissions: string[];
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-rose-100 text-rose-800 border-rose-200",
  hr: "bg-sky-100 text-sky-800 border-sky-200",
  manager: "bg-amber-100 text-amber-800 border-amber-200",
  employee: "bg-blue-100 text-blue-800 border-blue-200",
  member: "bg-gray-100 text-gray-800 border-gray-200",
};

// For these roles the permission applies to the person's own records only
// (their own attendance, leave, payslips and reviews), not the whole company.
const OWN_DATA_ROLES = new Set(["employee", "member"]);
const OWN_DATA_PERMISSIONS = new Set([
  "attendance:manage",
  "leave:manage",
  "payroll:read",
  "performance:read",
  "attendance:read",
  "leave:read",
]);

function categoryOf(permissionKey: string) {
  const prefix = permissionKey.split(":")[0];
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [permissionsList, setPermissionsList] = useState<PermissionInfo[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/roles");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(errorText(data.error, "Failed to fetch roles"));
        }
        setRoles(data.roles ?? []);
        setPermissionsList(data.permissions ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch roles");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const categories = Array.from(
    new Set(permissionsList.map((p) => categoryOf(p.key))),
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Roles & Permissions"
        description="Access matrix showing granular permissions configured for each organization role."
      />

      <CustomRolesPanel />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-foreground">Built-in roles</h2>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-70">
                  Module &amp; Permission
                </TableHead>
                {roles.map((role) => (
                  <TableHead key={role.key} className="text-center">
                    <Badge
                      className={ROLE_COLORS[role.key] ?? ROLE_COLORS.member}
                    >
                      {role.name}
                    </Badge>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.flatMap((category) => [
                <TableRow
                  key={`header-${category}`}
                  className="bg-muted/50 hover:bg-muted/50"
                >
                  <TableCell
                    colSpan={roles.length + 1}
                    className="py-2.5 text-xs font-bold tracking-wider text-primary uppercase"
                  >
                    {category} Management
                  </TableCell>
                </TableRow>,
                ...permissionsList
                  .filter((p) => categoryOf(p.key) === category)
                  .map((perm) => (
                    <TableRow key={perm.key}>
                      <TableCell className="whitespace-normal">
                        <p className="font-semibold text-foreground">
                          {perm.name}
                        </p>
                        {perm.description && (
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            {perm.description}
                          </p>
                        )}
                      </TableCell>
                      {roles.map((role) => {
                        const allowed = role.permissions.includes(perm.key);
                        const ownOnly =
                          allowed &&
                          OWN_DATA_ROLES.has(role.key) &&
                          OWN_DATA_PERMISSIONS.has(perm.key);

                        return (
                          <TableCell key={role.key} className="text-center">
                            {ownOnly ? (
                              <Badge
                                variant="secondary"
                                className="bg-sky-100 text-sky-800"
                              >
                                Own only
                              </Badge>
                            ) : allowed ? (
                              <Badge
                                variant="default"
                                className="h-6 w-6 justify-center rounded-full bg-emerald-100 p-0 text-emerald-800"
                              >
                                <CheckIcon className="size-4" aria-hidden />
                                <span className="sr-only">Allowed</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="h-6 w-6 justify-center rounded-full bg-muted p-0 text-muted-foreground"
                              >
                                <XIcon className="size-3.5" aria-hidden />
                                <span className="sr-only">Not allowed</span>
                              </Badge>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )),
              ])}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
