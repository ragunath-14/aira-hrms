import type { ReactNode } from "react";
import HRLayout from "@/components/hr/hr-layout";

export default function HRRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <HRLayout>{children}</HRLayout>;
}