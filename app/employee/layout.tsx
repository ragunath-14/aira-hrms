import type { ReactNode } from "react";

import { requireApprovedCompany } from "@/lib/auth/access-gate";
import EmployeeShell from "./employee-shell";

export default async function EmployeeLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireApprovedCompany();

  return <EmployeeShell>{children}</EmployeeShell>;
}
