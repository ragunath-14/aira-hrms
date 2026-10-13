// Company-wide settings with safe defaults. Stored as JSON on the tenant row
// (Settings -> System); anything not set falls back to these values.
export type TenantSettings = {
  theme: "light" | "dark" | "system";
  timezone: string;
  language: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  notifyPayroll: boolean;
  notifyLeave: boolean;
  notifySystem: boolean;

  // Leave: when false (default), Saturdays, Sundays and company holidays are
  // not counted as leave days.
  leaveCountNonWorkingDays: boolean;

  // Attendance rules (times are in the company timezone, 24-hour "HH:mm").
  shiftStart: string;
  graceMinutes: number;
  halfDayAfter: string;
  minFullDayHours: number;
};

export const SETTING_DEFAULTS: TenantSettings = {
  theme: "light",
  timezone: "Asia/Kolkata",
  language: "en",
  dateFormat: "DD/MM/YYYY",
  notifyPayroll: true,
  notifyLeave: true,
  notifySystem: false,
  leaveCountNonWorkingDays: false,
  shiftStart: "09:30",
  graceMinutes: 15,
  halfDayAfter: "13:00",
  minFullDayHours: 4,
};

export function resolveSettings(raw: unknown): TenantSettings {
  const stored =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return { ...SETTING_DEFAULTS, ...stored } as TenantSettings;
}

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Minutes since midnight of an instant, in the given timezone.
export function minutesInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  return hour * 60 + minute;
}

// Calendar date (YYYY-MM-DD) of an instant, in the given timezone.
export function dateInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Status for a new check-in, from the company's attendance rules.
export function statusForCheckIn(checkIn: Date, settings: TenantSettings) {
  const minutes = minutesInZone(checkIn, settings.timezone);

  if (minutes > toMinutes(settings.halfDayAfter)) return "half_day";
  if (minutes > toMinutes(settings.shiftStart) + settings.graceMinutes) return "late";

  return "present";
}
