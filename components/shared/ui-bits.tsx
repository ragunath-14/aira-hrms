import type { ReactNode } from "react";
import { formatDate } from "@/lib/format/date";

// Native <select> styled to match the shadcn Input.
export const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const TONES = {
  gray: "bg-muted text-muted-foreground",
  blue: "bg-primary/10 text-primary",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  red: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
} as const;

export type Tone = keyof typeof TONES;

export function Pill({
  tone = "gray",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

// Reads the JSON error body our API routes return.
export async function apiError(res: Response, fallback: string) {
  try {
    const data = await res.json();
    if (typeof data?.error === "string") return data.error;
    if (data?.error?.fieldErrors) {
      const first = Object.values(data.error.fieldErrors).flat()[0];
      if (typeof first === "string") return first;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function shortDate(iso: string) {
  return formatDate(iso.slice(0, 10));
}
