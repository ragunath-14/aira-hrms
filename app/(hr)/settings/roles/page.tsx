"use client";

import { useEffect, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";

import { PageHeader } from "@/components/hr/page-header";
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
          throw new Error(data.error || "Failed to fetch roles");
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

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

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
              {categories.map((category) => (
                <TableRow
                  key={category}
                  className="bg-muted/50 hover:bg-muted/50"
                >
                  <TableCell
                    colSpan={roles.length + 1}
                    className="py-2.5 text-xs font-bold tracking-wider text-primary uppercase"
                  >
                    {category} Management
                  </TableCell>
                </TableRow>
              ))}
              {categories.flatMap((cat) =>
                permissionsList
                  .filter((p) => categoryOf(p.key) === cat)
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
                        return (
                          <TableCell key={role.key} className="text-center">
                            {allowed ? (
                              <Badge
                                variant="default"
                                className="h-6 w-6 justify-center rounded-full bg-emerald-100 p-0 text-emerald-800"
                              >
                                <CheckIcon className="size-4" />
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="h-6 w-6 justify-center rounded-full bg-muted p-0 text-muted-foreground"
                              >
                                <XIcon className="size-3.5" />
                              </Badge>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )),
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
