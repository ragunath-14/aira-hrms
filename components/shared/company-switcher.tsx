"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { errorText } from "@/lib/format/error-text";

export type MyCompany = {
  tenantId: string;
  name: string;
  slug: string;
  role: string;
  status: string;
  active: boolean;
};

// The companies this login belongs to (one login can belong to several).
export function useMyCompanies() {
  const [companies, setCompanies] = useState<MyCompany[]>([]);

  useEffect(() => {
    fetch("/api/tenants/mine")
      .then((r) => (r.ok ? r.json() : { companies: [] }))
      .then((d) => setCompanies(Array.isArray(d.companies) ? d.companies : []))
      .catch(() => setCompanies([]));
  }, []);

  return companies;
}

// Work in another company: remember the choice, then open that company's home
// (the employee workspace for employees, the HR console for everyone else).
export async function switchCompany(tenantId: string) {
  try {
    const res = await fetch("/api/tenants/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(errorText(data.error, "Could not switch company"));

    window.location.href = data.role === "employee" || data.role === "member" ? "/employee" : "/";
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Could not switch company");
  }
}

const label = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

// The sidebar's workspace box. With one company it is just a label; with
// several it becomes a menu to switch between them.
export function WorkspaceSwitcher({ name, slug }: { name?: string; slug?: string }) {
  const companies = useMyCompanies();

  const box = (
    <>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
        {(name ?? "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">{name ?? "Loading…"}</p>
        <p className="truncate text-[11px] text-sidebar-foreground/45">
          {slug ? `${slug}.aira-hrms` : "Isolated workspace"}
        </p>
      </div>
      <ChevronsUpDownIcon className="size-3.5 shrink-0 text-sidebar-foreground/35" />
    </>
  );

  const frame = "flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2";

  if (companies.length < 2) return <div className={frame}>{box}</div>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" aria-label="Switch company" className={`${frame} transition hover:bg-sidebar-accent/70`} />}
      >
        {box}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your companies</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <CompanyItem key={company.tenantId} company={company} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CompanyItem({ company }: { company: MyCompany }) {
  return (
    <DropdownMenuItem
      disabled={company.status !== "approved"}
      onClick={() => {
        if (!company.active) void switchCompany(company.tenantId);
      }}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{company.name}</span>
        <span className="text-xs text-muted-foreground">
          {label(company.role)}
          {company.status !== "approved" ? " · not active" : ""}
        </span>
      </span>
      {company.active && <CheckIcon />}
    </DropdownMenuItem>
  );
}
