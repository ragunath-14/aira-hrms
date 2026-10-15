"use client";

import { useMemo, useState, useEffect } from "react";
import { CrosshairIcon, MapPinIcon, PlusIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DataTablePagination,
  paginate,
} from "@/components/shared/data-table-pagination";
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
import { DeleteButton } from "@/components/shared/delete-button";
import { errorText } from "@/lib/format/error-text";

type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  geofenceRadiusM: number | null;
};

const PAGE_SIZE = 10;

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("");
  const [locating, setLocating] = useState(false);

  async function loadLocations() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/locations");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(errorText(data.error, "Failed to fetch locations"));
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

  function openCreate() {
    setEditingId(null);
    setName("");
    setAddress("");
    setCity("");
    setState("");
    setCountry("");
    setLatitude("");
    setLongitude("");
    setRadius("");
    setError("");
    setShowForm(true);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser cannot share its location.");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        if (!radius) setRadius("200");
        setLocating(false);
      },
      () => {
        setError("Could not get your location. Allow location access in your browser, or type the coordinates.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function openEdit(location: Location) {
    setEditingId(location.id);
    setName(location.name);
    setAddress(location.address ?? "");
    setCity(location.city ?? "");
    setState(location.state ?? "");
    setCountry(location.country ?? "");
    setLatitude(location.latitude ?? "");
    setLongitude(location.longitude ?? "");
    setRadius(location.geofenceRadiusM ? String(location.geofenceRadiusM) : "");
    setError("");
    setShowForm(true);
  }

  async function handleSaveLocation(
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

      const response = await fetch(
        editingId ? `/api/locations/${editingId}` : "/api/locations",
        {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          country: country.trim(),
          latitude: latitude.trim() === "" ? null : Number(latitude),
          longitude: longitude.trim() === "" ? null : Number(longitude),
          geofenceRadiusM: radius.trim() === "" ? null : Number(radius),
        }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to save location",
        );
      }

      setLocations((current) =>
        editingId
          ? current.map((x) => (x.id === editingId ? data : x))
          : [...current, data],
      );

      setName("");
      setAddress("");
      setCity("");
      setState("");
      setCountry("");
      setEditingId(null);
      setShowForm(false);
      toast.success(editingId ? "Location updated" : "Location created");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save location";
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
          <Button onClick={openCreate}>
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
                  <TableHead>Punch fence</TableHead>
                  <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
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
                    <TableCell className="text-muted-foreground">
                      {location.geofenceRadiusM ? `within ${location.geofenceRadiusM} m` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${location.name}`}
                        onClick={() => openEdit(location)}
                      >
                        <PencilIcon />
                      </Button>
                      <DeleteButton
                        url={`/api/locations/${location.id}`}
                        itemName={location.name}
                        description="Employees at it are kept, but they will no longer have a location."
                        onDeleted={loadLocations}
                      />
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
            <DialogTitle>{editingId ? "Edit Location" : "Add Location"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update this location's details." : "Add a new office or workplace location."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLocation} className="space-y-4">
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

            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Punch fence (optional)</p>
                  <p className="text-xs text-muted-foreground">
                    When the company requires location for check-in (Settings → System), employees of this
                    location can only punch within this distance of the point below.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
                  <CrosshairIcon /> {locating ? "Locating…" : "Use my current location"}
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="location-lat" className="mb-1.5">Latitude</Label>
                  <Input id="location-lat" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="13.082700" />
                </div>
                <div>
                  <Label htmlFor="location-lng" className="mb-1.5">Longitude</Label>
                  <Input id="location-lng" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="80.270700" />
                </div>
                <div>
                  <Label htmlFor="location-radius" className="mb-1.5">Radius (metres)</Label>
                  <Input id="location-radius" type="number" min="20" step="10" value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="200" />
                </div>
              </div>
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
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
