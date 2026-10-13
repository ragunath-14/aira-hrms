"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2Icon,
  ExternalLinkIcon,
  MapPinIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

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
          const body = await compRes.json().catch(() => null);
          throw new Error(
            `Failed to load company profile (HTTP ${compRes.status}${
              body?.error ? `: ${body.error}` : ""
            })`,
          );
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
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold text-destructive">
              Error Loading Profile
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || "Could not retrieve company profile information."}
            </p>
            <div className="mt-4">
              <Button
                variant="destructive"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
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
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Company Profile"
        description="Overview of your organization's structure and details."
        action={
          <Button variant="outline" render={<Link href="/settings/company" />}>
            <SettingsIcon />
            Edit Settings
          </Button>
        }
      />

      {/* Hero */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-5 px-6 sm:flex-row sm:items-center">
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo}
              alt={`${company.name} Logo`}
              className="h-20 w-20 rounded-2xl border bg-muted object-contain p-2 shadow-sm"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-sm">
              {companyInitials}
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {company.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Slug:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-primary">
                {company.slug}
              </code>
            </p>
            {company.website && (
              <a
                href={
                  company.website.startsWith("http")
                    ? company.website
                    : `https://${company.website}`
                }
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                {company.website}
                <ExternalLinkIcon className="size-3.5" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Employees"
          value={employees.length}
          icon={UsersIcon}
        />
        <StatCard
          label="Total Departments"
          value={departments.length}
          icon={Building2Icon}
        />
        <StatCard
          label="Total Designations"
          value={designations.length}
          icon={Building2Icon}
        />
        <StatCard
          label="Total Locations"
          value={locations.length}
          icon={MapPinIcon}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="designations">Designations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-4 px-6">
                <h3 className="border-b pb-3 text-lg font-bold text-foreground">
                  Contact Information
                </h3>
                <div className="grid gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Email Address
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {company.email || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Phone Number
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {company.phone || "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 px-6">
                <h3 className="border-b pb-3 text-lg font-bold text-foreground">
                  Address & Location
                </h3>
                <div className="grid gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Street Address
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {company.address || "—"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        City
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {company.city || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        State
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {company.state || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Country
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {company.country || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <Card>
            <CardContent className="px-6">
              <div className="mb-4 flex items-center justify-between border-b pb-4">
                <h3 className="text-lg font-bold text-foreground">
                  Locations ({locations.length})
                </h3>
                <Link
                  href="/locations"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Manage Locations
                </Link>
              </div>
              {locations.length === 0 ? (
                <EmptyState
                  icon={MapPinIcon}
                  title="No locations configured"
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {locations.map((loc) => (
                    <div
                      key={loc.id}
                      className="rounded-xl border bg-muted/50 p-4 transition hover:border-foreground/20"
                    >
                      <p className="font-semibold text-foreground">
                        {loc.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {loc.address}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[loc.city, loc.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <Card>
            <CardContent className="px-6">
              <div className="mb-4 flex items-center justify-between border-b pb-4">
                <h3 className="text-lg font-bold text-foreground">
                  Departments ({departments.length})
                </h3>
                <Link
                  href="/departments"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Manage Departments
                </Link>
              </div>
              {departments.length === 0 ? (
                <EmptyState
                  icon={Building2Icon}
                  title="No departments configured"
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="rounded-xl border bg-muted/50 p-4 transition hover:border-foreground/20"
                    >
                      <p className="font-semibold text-foreground">
                        {dept.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {dept.description || "No description provided."}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="designations" className="mt-4">
          <Card>
            <CardContent className="px-6">
              <div className="mb-4 flex items-center justify-between border-b pb-4">
                <h3 className="text-lg font-bold text-foreground">
                  Designations ({designations.length})
                </h3>
                <Link
                  href="/designations"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Manage Designations
                </Link>
              </div>
              {designations.length === 0 ? (
                <EmptyState
                  icon={Building2Icon}
                  title="No designations configured"
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {designations.map((desig) => (
                    <div
                      key={desig.id}
                      className="rounded-xl border bg-muted/50 p-4 transition hover:border-foreground/20"
                    >
                      <p className="font-semibold text-foreground">
                        {desig.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {desig.description || "No description provided."}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
