"use client";

import { TicketsView } from "@/components/features/tickets-view";
import { useIsHr } from "@/hooks/use-is-hr";

export default function Page() {
  const isHr = useIsHr();

  if (isHr === null) return null;

  return <TicketsView isHr={isHr} />;
}
