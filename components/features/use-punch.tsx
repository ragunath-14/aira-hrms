"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PunchDialog, type PunchPayload } from "@/components/features/punch-dialog";

type Kind = "check-in" | "check-out";

// Check in / check out with whatever proof the company asks for. `punch(kind)`
// either punches straight away or opens the dialog that collects location
// and/or a selfie first. Render `dialog` somewhere in the page.
export function usePunch(
  onDone: () => Promise<void> | void,
  extraBody?: (kind: Kind) => Record<string, unknown>,
) {
  const [needs, setNeeds] = useState({ location: false, photo: false });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Kind | null>(null);

  useEffect(() => {
    fetch("/api/settings/display")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setNeeds({ location: Boolean(d.requirePunchLocation), photo: Boolean(d.requirePunchPhoto) });
      })
      .catch(() => {});
  }, []);

  // Returns an error message, or null when the punch went through.
  async function send(kind: Kind, payload: PunchPayload): Promise<{ message: string | null; code?: string }> {
    try {
      const res = await fetch(`/api/attendance/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(extraBody?.(kind) ?? {}), ...payload }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { message: typeof data.error === "string" ? data.error : "Request failed", code: data.code };
      }

      toast.success(kind === "check-in" ? "Checked in" : "Checked out");
      await onDone();

      return { message: null };
    } catch {
      return { message: "Request failed. Check your connection and try again." };
    }
  }

  async function punch(kind: Kind) {
    if (needs.location || needs.photo) {
      setPending(kind);
      return;
    }

    setBusy(true);
    const result = await send(kind, {});
    setBusy(false);

    if (!result.message) return;

    // The company switched proof on after this page loaded: ask for it now.
    if (result.code === "LOCATION_REQUIRED" || result.code === "PHOTO_REQUIRED") {
      setNeeds((current) => ({
        location: current.location || result.code === "LOCATION_REQUIRED",
        photo: current.photo || result.code === "PHOTO_REQUIRED",
      }));
      setPending(kind);
      return;
    }

    toast.error(result.message);
  }

  const dialog: ReactNode = pending ? (
    <PunchDialog
      open
      kind={pending}
      requireLocation={needs.location}
      requirePhoto={needs.photo}
      onCancel={() => setPending(null)}
      onSubmit={async (payload) => {
        const result = await send(pending, payload);

        if (!result.message) setPending(null);

        return result.message;
      }}
    />
  ) : null;

  return { punch, busy, dialog };
}
