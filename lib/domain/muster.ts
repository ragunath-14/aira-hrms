import type { PayrollRules } from "@/lib/config/payroll-rules";
import { daysInMonth, type AttendanceDay, type LeaveSpan } from "@/lib/domain/payroll-days";

// One cell of the muster roll.
//   P present   LT late   HD half day   A absent
//   PL paid leave   UL unpaid leave   WO weekly off   H holiday
//   -  before the person joined   (blank) a day still to come
export type MusterCode = "P" | "LT" | "HD" | "A" | "PL" | "UL" | "WO" | "H" | "-" | "";

export type MusterLeave = LeaveSpan;

export type MusterRow = {
  codes: MusterCode[];
  present: number; // half days count as 0.5
  late: number;
  halfDays: number;
  absent: number;
  paidLeave: number;
  unpaidLeave: number;
  weeklyOffs: number;
  holidays: number;
};

export function buildMusterRow(input: {
  period: string;
  joinDate: string | null;
  today: string;
  holidays: Set<string>;
  attendance: Map<string, AttendanceDay>;
  leaves: MusterLeave[];
  rules: PayrollRules;
}): MusterRow {
  const [year, month] = input.period.split("-").map(Number);
  const weeklyOff = new Set(input.rules.weeklyOffDays);
  const codes: MusterCode[] = [];
  const row: MusterRow = {
    codes,
    present: 0,
    late: 0,
    halfDays: 0,
    absent: 0,
    paidLeave: 0,
    unpaidLeave: 0,
    weeklyOffs: 0,
    holidays: 0,
  };

  for (let day = 1; day <= daysInMonth(input.period); day++) {
    const date = `${input.period}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const record = input.attendance.get(date);
    const leave = input.leaves.find((span) => date >= span.start && date <= span.end);
    const isHoliday = input.holidays.has(date);
    const isWeeklyOff = weeklyOff.has(weekday);

    let code: MusterCode;

    if (input.joinDate && date < input.joinDate) {
      code = "-";
    } else if (record?.status === "present") {
      code = "P";
      row.present += 1;
    } else if (record?.status === "late") {
      code = "LT";
      row.present += 1;
      row.late += 1;
    } else if (record?.status === "half_day") {
      code = "HD";
      row.present += 0.5;
      row.halfDays += 1;
    } else if (isHoliday) {
      code = "H";
      row.holidays += 1;
    } else if (isWeeklyOff) {
      code = "WO";
      row.weeklyOffs += 1;
    } else if (leave) {
      // Leave only takes working days, like the leave balance does.
      code = leave.paid ? "PL" : "UL";
      if (leave.paid) row.paidLeave += 1;
      else row.unpaidLeave += 1;
    } else if (date > input.today) {
      code = "";
    } else {
      code = "A";
      row.absent += 1;
    }

    codes.push(code);
  }

  return row;
}
