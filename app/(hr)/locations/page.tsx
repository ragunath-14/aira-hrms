"use client";

import { useMemo, useState, useEffect } from "react";
import { MapPinIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/hr/page-header";
import { EmptyState } from "@/components/hr/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/hr/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

const PAGE_SIZE = 10;

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");

  async function loadLocations() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/locations");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch locations");
      }

      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch locations",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLocations();
  }, []);

  async function handleCreateLocation(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Location name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          country: country.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create location");
      }

      setLocations((current) => [...current, data]);

      setName("");
      setAddress("");
      setCity("");
      setState("");
      setCountry("");
      setShowForm(false);
      toast.success("Location created");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create location";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const pagedLocations = useMemo(
    () => paginate(locations, page, PAGE_SIZE),
    [locations, page],
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Locations"
        description="Manage company office and workplace locations."
        action={
          <Button
            onClick={() => {
              setShowForm(true);
              setError("");
            }}
          >
            <PlusIcon />
            Add Location
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b px-6 py-5">
          <h2 className="text-lg font-semibold text-foreground">
            Location List
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {locations.length} location{locations.length === 1 ? "" : "s"}{" "}
            found
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : locations.length === 0 ? (
          <EmptyState
            icon={MapPinIcon}
            title="No locations found"
            description="Add your first company location to get started."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Country</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedLocations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium text-foreground">
                      {location.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.address || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.city || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.state || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.country || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={locations.length}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
            <DialogDescription>
              Add a new office or workplace location.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateLocation} className="space-y-4">
            <div>
              <Label htmlFor="location-name" className="mb-1.5">
                Location Name
              </Label>
              <Input
                id="location-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Chennai Office"
              />
            </div>

            <div>
              <Label htmlFor="location-address" className="mb-1.5">
                Address
              </Label>
              <Textarea
                id="location-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Office address"
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="location-city" className="mb-1.5">
                  City
                </Label>
                <Input
                  id="location-city"
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="City"
                />
              </div>

              <div>
                <Label htmlFor="location-state" className="mb-1.5">
                  State
                </Label>
                <Input
                  id="location-state"
                  type="text"
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                  placeholder="State"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location-country" className="mb-1.5">
                Country
              </Label>
              <Input
                id="location-country"
                type="text"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="Country"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
