import type { ReactNode } from "react";

import HRLayout from "@/components/layout/hr-layout";
import { requireApprovedCompany } from "@/lib/auth/access-gate";

export default async function HRRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireApprovedCompany();

  return <HRLayout>{children}</HRLayout>;
}
