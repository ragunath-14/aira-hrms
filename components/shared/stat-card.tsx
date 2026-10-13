import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

const TONE_CLASSES = {
  positive: "text-emerald-600",
  neutral: "text-primary",
  warning: "text-amber-600",
  muted: "text-muted-foreground",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {label}
          </p>

          {Icon && (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-3.5" />
            </div>
          )}
        </div>

        <p className="mt-2 truncate text-2xl font-bold text-foreground">
          {value}
        </p>

        {hint && (
          <p className={cn("mt-1 text-xs font-medium", TONE_CLASSES[tone])}>
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
