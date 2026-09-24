import { Badge } from "@/components/ui/badge";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // positive / completed
  active: "default",
  present: "default",
  approved: "default",
  processed: "default",
  paid: "default",
  generated: "default",

  // neutral / in-progress
  inactive: "secondary",
  half_day: "secondary",
  draft: "secondary",
  leave: "secondary",
  holiday: "secondary",
  on_leave: "secondary",

  // needs attention
  pending: "outline",
  late: "outline",

  // negative
  absent: "destructive",
  rejected: "destructive",
  terminated: "destructive",
  cancelled: "destructive",
  offboarded: "destructive",
};

function formatLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANTS[status.toLowerCase()] ?? "outline";

  return <Badge variant={variant}>{formatLabel(status)}</Badge>;
}
