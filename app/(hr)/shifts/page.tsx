"use client";

import { ShiftsView } from "@/components/features/shifts-view";
import { useIsHr } from "@/hooks/use-is-hr";

export default function Page() {
  const isHr = useIsHr();

  if (isHr === null) return null;

  return <ShiftsView isHr={isHr} />;
}
