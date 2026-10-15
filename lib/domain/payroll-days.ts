import type { PayrollRules } from "@/lib/config/payroll-rules";

// Turns a month of attendance, leave and holidays into the days a person is
// paid for. Pure (no database, no clock) so every rule can be checked alone.

export type AttendanceDay = {
  status: string;
  checkIn: Date | null;
  checkOut: Date | null;
};

// An approved leave, dates inclusive (YYYY-MM-DD).
export type LeaveSpan = { start: string; end: string; paid: boolean };

export type DaysInput = {
  period: string; // YYYY-MM
  joinDate: string | null; // YYYY-MM-DD; pay starts that day
  today: string; // YYYY-MM-DD; days after it have not happened yet
  holidays: Set<string>;
  attendance: Map<string, AttendanceDay>;
  leaves: LeaveSpan[];
  rules: PayrollRules;
};

export type DaysResult = {
  // The days a month's pay is spread over: every calendar day, or every working day.
  divisor: number;
  // Working days in the month (weekly offs and holidays excluded).
  workingDays: number;
  // Of the divisor, the days the person was employed.
  employedDays: number;
  absentDays: number;
  unpaidLeaveDays: number;
  halfDays: number;
  lateMarks: number;
  lopDays: number;
  paidDays: number;
  // paidDays / divisor: the share of the month's pay that is earned.
  fraction: number;
  overtimeMinutes: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function daysInMonth(period: string) {
  const [year, month] = period.split("-").map(Number);

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function computeDays(input: DaysInput): DaysResult {
  const { rules, period } = input;
  const [year, month] = period.split("-").map(Number);
  const total = daysInMonth(period);
  const weeklyOff = new Set(rules.weeklyOffDays);

  let divisor = 0;
  let workingDays = 0;
  let employedDays = 0;
  let absent = 0;
  let unpaidLeave = 0;
  let halfDays = 0;
  let late = 0;
  let overtimeMinutes = 0;

  for (let day = 1; day <= total; day++) {
    const date = `${period}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const isOff = weeklyOff.has(weekday) || input.holidays.has(date);
    const counts = rules.dayBasis === "calendar" || !isOff;
    const employed = !input.joinDate || date >= input.joinDate;

    if (!isOff) workingDays++;
    if (counts) divisor++;
    if (counts && employed) employedDays++;

    if (!employed) continue;

    const record = input.attendance.get(date);

    // Overtime comes from the hours between check-in and check-out.
    if (rules.overtime.enabled && record?.checkIn && record.checkOut) {
      const worked = (record.checkOut.getTime() - record.checkIn.getTime()) / 60000;

      if (worked > 0) {
        let extra: number;

        if (isOff && rules.overtime.offDayAllHours) {
          extra = worked;
        } else {
          extra = worked - rules.overtime.standardHours * 60;
          if (extra <= rules.overtime.bufferMinutes) extra = 0;
        }

        const step = rules.overtime.roundMinutes;
        overtimeMinutes += Math.floor(extra / step) * step;
      }
    }

    // Days that have not happened yet, and days off, never cost pay.
    if (date > input.today || isOff) continue;

    const leave = input.leaves.find((span) => date >= span.start && date <= span.end);

    if (record && (record.status === "present" || record.status === "late" || record.status === "half_day")) {
      if (record.status === "late") late++;
      if (record.status === "half_day") halfDays++;
    } else if (leave) {
      if (!leave.paid) unpaidLeave++;
    } else if (record?.status === "absent") {
      absent++;
    } else if (!record && rules.absentIsLop) {
      absent++;
    }
  }

  const lateLop = rules.lateMarksPerLop > 0 ? Math.floor(late / rules.lateMarksPerLop) : 0;
  const lop = Math.min(
    employedDays,
    absent + unpaidLeave + halfDays * rules.halfDayLopDays + lateLop,
  );
  const paidDays = round2(Math.max(0, employedDays - lop));

  return {
    divisor,
    workingDays,
    employedDays,
    absentDays: absent,
    unpaidLeaveDays: unpaidLeave,
    halfDays,
    lateMarks: late,
    lopDays: round2(lop),
    paidDays,
    fraction: divisor > 0 ? paidDays / divisor : 1,
    overtimeMinutes,
  };
}

// Overtime pay: the hourly rate is the full monthly basic over the month's
// working days and a standard day's hours, times the overtime multiplier.
export function overtimePay(params: {
  minutes: number;
  monthlyBasic: number;
  workingDays: number;
  rules: PayrollRules;
}) {
  const { minutes, monthlyBasic, workingDays, rules } = params;

  if (!rules.overtime.enabled || minutes <= 0 || workingDays <= 0) return 0;

  const hourly = monthlyBasic / (workingDays * rules.overtime.standardHours);

  return round2((minutes / 60) * hourly * rules.overtime.multiplier);
}
