"use client";

import { useEffect, useState } from "react";

import { HolidaysView } from "@/components/features/holidays-view";

export default function HolidaysPage() {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    fetch("/api/tenant")
      .then((r) => r.json())
      .then((d) =>
        setCanManage(["owner", "admin", "hr"].includes(d?.membership?.role)),
      )
      .catch(() => {});
  }, []);

  return <HolidaysView canManage={canManage} />;
}
