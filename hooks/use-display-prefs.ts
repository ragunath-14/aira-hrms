"use client";

import { useEffect, useState } from "react";

import { setDisplayPrefs } from "@/lib/format/date";

// Loads the company's date format once. If it differs from what was cached
// (first visit, or the format was just changed) the returned key changes so the
// page content re-renders with the new format.
export function useDisplayPrefs(enabled = true) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    fetch("/api/settings/display")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (setDisplayPrefs({ dateFormat: data.dateFormat, timezone: data.timezone })) {
          setVersion((v) => v + 1);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return version;
}
