"use client";

import { useEffect, useState } from "react";

const HR_ROLES = ["owner", "admin", "hr"];

// null while the role is still loading, so pages can avoid flashing the wrong view.
export function useIsHr() {
  const [isHr, setIsHr] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/tenant")
      .then((r) => r.json())
      .then((d) => setIsHr(HR_ROLES.includes(d?.membership?.role)))
      .catch(() => setIsHr(false));
  }, []);

  return isHr;
}
