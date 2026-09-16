"use client";

import { useEffect, useState } from "react";

type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        throw new Error(
          data.error || "Failed to fetch locations",
        );
      }

      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch locations",
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
        throw new Error(
          data.error || "Failed to create location",
        );
      }

      setLocations((current) => [...current, data]);

      setName("");
      setAddress("");
      setCity("");
      setState("");
      setCountry("");
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create location",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Locations
            </h1>

            <p className="mt-2 text-gray-500">
              Manage company office and workplace locations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
            }}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            {showForm ? "Cancel" : "Add Location"}
          </button>
        </div>

        {showForm && (
          <section className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Add Location
            </h2>

            <form
              onSubmit={handleCreateLocation}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="location-name"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Location Name
                </label>

                <input
                  id="location-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Chennai Office"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div>
                <label
                  htmlFor="location-address"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Address
                </label>

                <textarea
                  id="location-address"
                  value={address}
                  onChange={(event) =>
                    setAddress(event.target.value)
                  }
                  placeholder="Office address"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="location-city"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    City
                  </label>

                  <input
                    id="location-city"
                    type="text"
                    value={city}
                    onChange={(event) =>
                      setCity(event.target.value)
                    }
                    placeholder="City"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="location-state"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    State
                  </label>

                  <input
                    id="location-state"
                    type="text"
                    value={state}
                    onChange={(event) =>
                      setState(event.target.value)
                    }
                    placeholder="State"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="location-country"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Country
                </label>

                <input
                  id="location-country"
                  type="text"
                  value={country}
                  onChange={(event) =>
                    setCountry(event.target.value)
                  }
                  placeholder="Country"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Location"}
                </button>
              </div>
            </form>
          </section>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-semibold text-gray-900">
              Location List
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {locations.length} location
              {locations.length === 1 ? "" : "s"} found
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading locations...
            </div>
          ) : locations.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                No locations found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Add your first company location to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50 text-sm text-gray-500">
                    <th className="px-6 py-4 font-medium">
                      Location
                    </th>

                    <th className="px-6 py-4 font-medium">
                      Address
                    </th>

                    <th className="px-6 py-4 font-medium">
                      City
                    </th>

                    <th className="px-6 py-4 font-medium">
                      State
                    </th>

                    <th className="px-6 py-4 font-medium">
                      Country
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {locations.map((location) => (
                    <tr
                      key={location.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {location.name}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {location.address || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {location.city || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {location.state || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {location.country || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}