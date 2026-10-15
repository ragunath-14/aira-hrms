import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { locations } from "@/db/schema/organization";
import type { TenantSettings } from "@/lib/config/settings";
import { detectImage } from "@/lib/domain/photos";

// Where and how a punch was made, when the company asks for proof: the
// browser's location (checked against the employee's site) and a selfie.

export const MAX_PUNCH_PHOTO_BYTES = 200 * 1024;

// Locations less precise than this say nothing useful about where someone is.
const MAX_ACCURACY_M = 500;

// Straight-line distance between two points, in metres (haversine).
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;

  return Math.round(2 * earth * Math.asin(Math.min(1, Math.sqrt(a))));
}

export type PunchProof = {
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
  photo: { mimeType: string; data: Buffer } | null;
};

const refuse = (error: string, code: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, code, ...extra }, { status });

// Reads the proof sent with a punch and applies the company's rules. Returns a
// response to send back when the punch must be refused, otherwise the proof to
// store with it.
export async function checkPunchProof(params: {
  settings: TenantSettings;
  locationId: string | null;
  body: unknown;
}): Promise<{ response: NextResponse } | { proof: PunchProof }> {
  const body = (params.body && typeof params.body === "object" ? params.body : {}) as Record<string, unknown>;

  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;
  const accuracy = typeof body.accuracy === "number" ? body.accuracy : null;
  const hasLocation =
    latitude !== null &&
    longitude !== null &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  const proof: PunchProof = {
    latitude: hasLocation ? latitude : null,
    longitude: hasLocation ? longitude : null,
    distanceM: null,
    photo: null,
  };

  if (params.settings.requirePunchLocation && !hasLocation) {
    return {
      response: refuse(
        "Your location is needed to punch. Allow location access in your browser and try again.",
        "LOCATION_REQUIRED",
      ),
    };
  }

  if (hasLocation && accuracy !== null && accuracy > MAX_ACCURACY_M) {
    if (params.settings.requirePunchLocation) {
      return {
        response: refuse(
          `Your location is not accurate enough (about ${Math.round(accuracy)} m). Move to an open area or turn on precise location, then try again.`,
          "LOCATION_INACCURATE",
        ),
      };
    }

    proof.latitude = null;
    proof.longitude = null;
  }

  // The employee's site, when it has a fence set.
  if (proof.latitude !== null && proof.longitude !== null && params.locationId) {
    const [site] = await db
      .select({
        name: locations.name,
        latitude: locations.latitude,
        longitude: locations.longitude,
        radius: locations.geofenceRadiusM,
      })
      .from(locations)
      .where(eq(locations.id, params.locationId))
      .limit(1);

    if (site?.latitude && site.longitude && site.radius) {
      proof.distanceM = distanceMeters(proof.latitude, proof.longitude, Number(site.latitude), Number(site.longitude));

      if (params.settings.requirePunchLocation && proof.distanceM > site.radius) {
        return {
          response: refuse(
            `You are about ${proof.distanceM} m from ${site.name}. Punching is allowed within ${site.radius} m of it.`,
            "OUTSIDE_GEOFENCE",
            403,
            { distanceM: proof.distanceM, radiusM: site.radius },
          ),
        };
      }
    }
  }

  // Selfie: a small image sent as a data address.
  const photo = typeof body.photo === "string" ? body.photo : "";
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photo);

  if (match) {
    const data = Buffer.from(match[1], "base64");
    const mimeType = detectImage(data);

    if (!mimeType || data.length === 0 || data.length > MAX_PUNCH_PHOTO_BYTES) {
      if (params.settings.requirePunchPhoto) {
        return {
          response: refuse("The photo could not be used. Take it again.", "PHOTO_INVALID"),
        };
      }
    } else {
      proof.photo = { mimeType, data };
    }
  }

  if (params.settings.requirePunchPhoto && !proof.photo) {
    return {
      response: refuse("A photo is needed to punch. Allow camera access and take a photo.", "PHOTO_REQUIRED"),
    };
  }

  return { proof };
}
