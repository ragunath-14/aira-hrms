// How a company turns attendance into pay (Settings -> Payroll Rules).
//
// Everything is off by default: until a company switches "pay by attendance" on,
// payroll pays the full monthly salary exactly as it always has.

export type PayrollRules = {
  // Reduce salary for days not worked (absent without leave, unpaid leave, and
  // the late / half-day rules below).
  linkAttendance: boolean;

  // What a day of salary is worth: monthly pay divided by every calendar day of
  // the month, or by the month's working days (weekly offs and holidays out).
  dayBasis: "calendar" | "working";

  // Weekdays that are weekly offs, 0 = Sunday ... 6 = Saturday.
  weeklyOffDays: number[];

  // A working day with no attendance and no approved leave is loss of pay.
  absentIsLop: boolean;

  // Days of pay lost for a half day (0 = none, 0.5 = half a day).
  halfDayLopDays: number;

  // This many late marks in a month cost one day of pay (0 = off).
  lateMarksPerLop: number;

  overtime: {
    enabled: boolean;
    // Pay is this many times the normal hourly rate.
    multiplier: number;
    // A normal day's working hours; time beyond it is overtime.
    standardHours: number;
    // Minutes past standard hours that do not count (a grace window).
    bufferMinutes: number;
    // Overtime is rounded down to this many minutes.
    roundMinutes: 1 | 15 | 30 | 45 | 60;
    // Every hour worked on a weekly off or holiday is overtime.
    offDayAllHours: boolean;
  };
};

export const PAYROLL_RULE_DEFAULTS: PayrollRules = {
  linkAttendance: false,
  dayBasis: "calendar",
  weeklyOffDays: [0, 6],
  absentIsLop: true,
  halfDayLopDays: 0.5,
  lateMarksPerLop: 0,
  overtime: {
    enabled: false,
    multiplier: 1.5,
    standardHours: 8,
    bufferMinutes: 15,
    roundMinutes: 15,
    offDayAllHours: false,
  },
};

// What a company stored, laid over the defaults group by group.
export function resolvePayrollRules(settings: unknown): PayrollRules {
  const stored =
    settings && typeof settings === "object"
      ? ((settings as Record<string, unknown>).payrollRules as Partial<Record<string, unknown>> | undefined)
      : undefined;

  const overtime = stored?.overtime;

  return {
    ...PAYROLL_RULE_DEFAULTS,
    ...(stored ?? {}),
    overtime: {
      ...PAYROLL_RULE_DEFAULTS.overtime,
      ...(overtime && typeof overtime === "object" ? overtime : {}),
    },
  } as PayrollRules;
}
