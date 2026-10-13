"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, KeyRoundIcon, PlusIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth/client";
import { PageHeader } from "@/components/layout/page-header";
import { ChangePasswordDialog } from "@/components/shared/change-password-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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

type AccessRequest = {
  id: string;
  companyName: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt: string | null;
  note: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

const EMPTY_COMPANY = {
  companyName: "",
  ownerName: "",
  ownerEmail: "",
  password: "",
  companyEmail: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  state: "",
  country: "India",
};

type Filter = "pending" | "approved" | "rejected" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Active" },
  { value: "rejected", label: "Suspended" },
  { value: "pending", label: "Pending" },
];

// A readable random password for the platform owner to hand over.
function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

const PAGE_SIZE = 10;

export default function AccessRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const [rejecting, setRejecting] = useState<AccessRequest | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [myPasswordOpen, setMyPasswordOpen] = useState(false);
  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [pwTarget, setPwTarget] = useState<AccessRequest | null>(null);
  const [newPw, setNewPw] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/tenants");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(errorText(data.error, "Access denied"));
      }

      setRequests(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Access denied");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
      all: requests.length,
    }),
    [requests],
  );

  const shown = useMemo(
    () =>
      filter === "all"
        ? requests
        : requests.filter((r) => r.status === filter),
    [requests, filter],
  );

  const paged = useMemo(
    () => paginate(shown, page, PAGE_SIZE),
    [shown, page],
  );

  async function decide(
    request: AccessRequest,
    action: "approve" | "reject",
    reason?: string,
  ) {
    try {
      setBusyId(request.id);

      const response = await fetch(`/api/admin/tenants/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: reason }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Update failed",
        );
      }

      toast.success(
        action === "approve"
          ? `${request.companyName} approved`
          : `${request.companyName} suspended`,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function submitCompany(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);

      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to create company");
      }

      toast.success(`${company.companyName} created. Share the login with ${company.ownerEmail}.`);
      setCreateOpen(false);
      setCompany(EMPTY_COMPANY);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setSaving(false);
    }
  }

  async function submitOwnerPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwTarget) return;

    try {
      setSaving(true);

      const res = await fetch(`/api/admin/tenants/${pwTarget.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPw }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to set password");
      }

      toast.success(`Password updated for ${pwTarget.ownerEmail}`);
      setPwTarget(null);
      setNewPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set password");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Companies"
          description="Create companies and give each owner a login. Each owner then adds their own team. This page never shows a company's data."
          action={
            <>
              <Button onClick={() => setCreateOpen(true)}>
                <PlusIcon /> Create company
              </Button>
              <Button variant="outline" onClick={() => setMyPasswordOpen(true)}>
                <KeyRoundIcon /> Change my password
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Sign out
              </Button>
            </>
          }
        />

        {error && !loading && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
            >
              {label} ({counts[value]})
            </Button>
          ))}
        </div>

        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            !error && (
              <EmptyState
                icon={ShieldCheckIcon}
                title="No companies here"
                description="Create a company to give its owner a login."
              />
            )
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Owner (user ID)</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium text-foreground">
                        {request.companyName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{request.ownerName ?? "—"}</div>
                        <div className="text-xs">{request.ownerEmail ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{[request.city, request.state].filter(Boolean).join(", ") || "—"}</div>
                        <div className="text-xs">{request.phone ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                        {request.status === "rejected" && request.note && (
                          <div className="mt-1 max-w-48 text-xs text-muted-foreground">
                            {request.note}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNewPw("");
                            setPwTarget(request);
                          }}
                        >
                          <KeyRoundIcon /> Set owner password
                        </Button>
                        {request.status !== "approved" && (
                          <Button
                            size="sm"
                            className="ml-2"
                            disabled={busyId === request.id}
                            onClick={() => decide(request, "approve")}
                          >
                            <CheckIcon /> {request.status === "rejected" ? "Restore" : "Approve"}
                          </Button>
                        )}
                        {request.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-2"
                            disabled={busyId === request.id}
                            onClick={() => {
                              setNote("");
                              setRejecting(request);
                            }}
                          >
                            <XIcon /> Suspend
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
                total={shown.length}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </div>

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Suspend access
            </DialogTitle>
            <DialogDescription>
              {rejecting?.companyName} will be locked out of the portal until you restore it. Their data is kept.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="reject-note" className="mb-1.5">
              Reason (shown to the company, optional)
            </Label>
            <Textarea
              id="reject-note"
              value={note}
              maxLength={500}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!rejecting) return;
                const target = rejecting;
                setRejecting(null);
                await decide(target, "reject", note.trim());
              }}
            >
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ChangePasswordDialog open={myPasswordOpen} onOpenChange={setMyPasswordOpen} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create company</DialogTitle>
            <DialogDescription>
              Note the company&apos;s details and give the owner a login. The owner signs in with their email (user ID) and this password, sees these details in Settings → Company (and can edit them), then adds their own team. Share the password privately; it cannot be viewed again.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitCompany} className="space-y-4">
            <div>
              <Label htmlFor="co-name" className="mb-1.5">Company name</Label>
              <Input id="co-name" required value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="co-owner" className="mb-1.5">Owner name</Label>
                <Input id="co-owner" required value={company.ownerName} onChange={(e) => setCompany({ ...company, ownerName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="co-email" className="mb-1.5">Owner email (user ID)</Label>
                <Input id="co-email" type="email" required value={company.ownerEmail} onChange={(e) => setCompany({ ...company, ownerEmail: e.target.value })} />
              </div>
            </div>
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-semibold text-foreground">Company details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="co-cemail" className="mb-1.5">Company email</Label>
                  <Input id="co-cemail" type="email" placeholder="Defaults to the owner email" value={company.companyEmail} onChange={(e) => setCompany({ ...company, companyEmail: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="co-phone" className="mb-1.5">Phone</Label>
                  <Input id="co-phone" type="tel" autoComplete="off" maxLength={20} value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="co-web" className="mb-1.5">Website</Label>
                  <Input id="co-web" type="url" placeholder="https://" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="co-addr" className="mb-1.5">Address</Label>
                  <Input id="co-addr" maxLength={300} value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="co-city" className="mb-1.5">City</Label>
                  <Input id="co-city" maxLength={80} value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="co-state" className="mb-1.5">State</Label>
                  <Input id="co-state" maxLength={80} value={company.state} onChange={(e) => setCompany({ ...company, state: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="co-country" className="mb-1.5">Country</Label>
                  <Input id="co-country" maxLength={80} value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="co-pass" className="mb-1.5">Password</Label>
              <div className="flex gap-2">
                <Input id="co-pass" required minLength={12} maxLength={128} autoComplete="off" value={company.password} onChange={(e) => setCompany({ ...company, password: e.target.value })} />
                <Button type="button" variant="outline" onClick={() => setCompany({ ...company, password: generatePassword() })}>
                  Generate
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">At least 12 characters.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || company.password.length < 12}>
                {saving ? "Creating…" : "Create company"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pwTarget !== null} onOpenChange={(open) => !open && setPwTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set owner password</DialogTitle>
            <DialogDescription>
              New password for {pwTarget?.ownerEmail} ({pwTarget?.companyName}). It replaces the current one, signs them out, and cannot be viewed afterwards.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitOwnerPassword} className="space-y-4">
            <div className="flex gap-2">
              <Input aria-label="New password" required minLength={12} maxLength={128} autoComplete="off" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => setNewPw(generatePassword())}>
                Generate
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={saving || newPw.length < 12}>
                {saving ? "Saving…" : "Set password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
