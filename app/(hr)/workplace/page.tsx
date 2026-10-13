"use client";

import { WorkplaceView } from "@/components/features/workplace-view";

export default function WorkplacePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <WorkplaceView portal="hr" />
    </div>
  );
}
