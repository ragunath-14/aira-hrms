"use client";

import { ExpensesView } from "@/components/features/expenses-view";
import { useIsHr } from "@/hooks/use-is-hr";

export default function Page() {
  const isHr = useIsHr();

  if (isHr === null) return null;

  return <ExpensesView isHr={isHr} />;
}
