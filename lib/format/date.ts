// Shows dates the way the company chose in Settings -> System (DD/MM/YYYY,
// MM/DD/YYYY or YYYY-MM-DD) in the company timezone. The preference is kept in
// memory and in localStorage so the first paint of every page already uses it.
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

const STORAGE_KEY = "aira.displayPrefs";

let prefs: { dateFormat: DateFormat; timezone: string } = {
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Kolkata",
};

if (typeof window !== "undefined") {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved?.dateFormat) prefs = { ...prefs, ...saved };
  } catch {
    /* storage unavailable: keep defaults */
  }
}

export function getDisplayPrefs() {
  return prefs;
}

// Returns true when something changed.
export function setDisplayPrefs(next: Partial<typeof prefs>) {
  const merged = { ...prefs, ...next };
  const changed =
    merged.dateFormat !== prefs.dateFormat || merged.timezone !== prefs.timezone;

  prefs = merged;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }

  return changed;
}

function layout(year: string, month: string, day: string) {
  switch (prefs.dateFormat) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

// Date only. A plain "YYYY-MM-DD" is used as-is (no timezone shift); any other
// value is read as an instant and shown in the company timezone.
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return layout(y, m, d);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: prefs.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return layout(get("year"), get("month"), get("day"));
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: prefs.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";

  return `${formatDate(value)}, ${formatTime(value)}`;
}


// Turns a wall-clock date and time in the given timezone ("2026-10-14", "15:30")
// into the matching UTC instant (ISO string), for saving a meeting time.
export function zonedToIso(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wanted = Date.UTC(y, m - 1, d, hh, mm);

  const asZone = (ms: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  };

  // The zone's offset at that moment; one correction handles daylight saving edges.
  let guess = wanted - (asZone(wanted) - wanted);
  guess = wanted - (asZone(guess) - guess);

  return new Date(guess).toISOString();
}
