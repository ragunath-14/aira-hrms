"use client";

import { useEffect, useState } from "react";

import { AnnouncementsView } from "@/components/features/announcements-view";

export default function AnnouncementsPage() {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    fetch("/api/tenant")
      .then((r) => r.json())
      .then((d) =>
        setCanManage(["owner", "admin", "hr"].includes(d?.membership?.role)),
      )
      .catch(() => {});
  }, []);

  return <AnnouncementsView canManage={canManage} />;
}
