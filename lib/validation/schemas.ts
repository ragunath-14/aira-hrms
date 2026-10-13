import { z } from "zod";

// True only for a real calendar date written YYYY-MM-DD (rejects 2026-02-30).
export function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

const realDate = (label: string) =>
  z.string().refine(isRealDate, `${label} must be a real date (YYYY-MM-DD)`);

// Forms send "" for an empty field; treat that as "not set".
const blankToNull = (value: unknown) => (value === "" ? null : value);

const optionalUuid = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().uuid().nullable().optional(),
);

const employeeFields = z.object({
    employeeCode: z.string().trim().min(1, "Employee code is required").max(30, "Employee code is too long"),
    firstName: z.string().trim().min(1, "First name is required").max(80, "First name is too long"),
    lastName: z.string().trim().max(80, "Last name is too long").nullable().optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Valid email is required")
      .max(200, "Email is too long"),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?[0-9][0-9 ()-]{6,19})?$/, "Phone must be 7 to 20 digits (spaces, +, - and brackets allowed)")
      .nullable()
      .optional(),
    dateOfJoining: z.preprocess(blankToNull, realDate("Date of joining").nullable().optional()),
    dateOfBirth: z.preprocess(blankToNull, realDate("Date of birth").nullable().optional()),
    departmentId: optionalUuid,
    designationId: optionalUuid,
    locationId: optionalUuid,
    managerId: optionalUuid,
    userId: optionalUuid,
    status: z.enum(["active", "inactive", "terminated"]).optional(),
});

function checkEmployeeDates(
  data: { dateOfBirth?: string | null; dateOfJoining?: string | null },
  ctx: z.RefinementCtx,
) {
    const today = new Date().toISOString().slice(0, 10);

    if (data.dateOfBirth && data.dateOfBirth > today) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth cannot be in the future" });
    }

    if (
      data.dateOfBirth &&
      data.dateOfJoining &&
      data.dateOfBirth >= data.dateOfJoining
    ) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth must be before the date of joining" });
    }
  }

export const employeeCreateSchema = employeeFields.superRefine(checkEmployeeDates);

export const employeeUpdateSchema = employeeFields.partial().superRefine(checkEmployeeDates);

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required"),
  description: z.string().trim().nullable().optional(),
});

export const designationSchema = z.object({
  name: z.string().trim().min(1, "Designation name is required"),
  description: z.string().trim().nullable().optional(),
});

export const locationSchema = z.object({
  name: z.string().trim().min(1, "Location name is required"),
  address: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
});

export const leaveRequestCreateSchema = z.object({
  leaveTypeId: z.string().uuid("A valid leave type is required"),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  reason: z.string().trim().nullable().optional(),
});

export const leaveTypeRulesUpdateSchema = z.object({
  carryForwardLimit: z.number().int().min(0).nullable().optional(),
  maxConsecutiveDays: z.number().int().min(0).nullable().optional(),
  minNoticeDays: z.number().int().min(0).nullable().optional(),
  encashmentAllowed: z.boolean().optional(),
  rulesText: z.string().trim().nullable().optional(),
});

export const leavePlanCreateSchema = z.object({
  leaveTypeId: z.string().uuid().nullable().optional(),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  note: z.string().trim().nullable().optional(),
});

export const leaveEncashmentCreateSchema = z.object({
  leaveTypeId: z.string().uuid("A valid leave type is required"),
  year: z.number().int(),
  daysRequested: z.number().int().min(1, "daysRequested must be at least 1"),
  reason: z.string().trim().nullable().optional(),
});

export const leaveAdjustmentCreateSchema = z.object({
  leaveTypeId: z.string().uuid("A valid leave type is required"),
  year: z.number().int(),
  requestedDays: z
    .number()
    .int()
    .min(-365, "requestedDays cannot be less than -365")
    .max(365, "requestedDays cannot exceed 365")
    .refine((value) => value !== 0, "requestedDays cannot be 0"),
  reason: z.string().trim().nullable().optional(),
});

export const ltcClaimCreateSchema = z.object({
  blockYear: z.string().trim().min(1, "blockYear is required"),
  travelStartDate: z.string().nullable().optional(),
  travelEndDate: z.string().nullable().optional(),
  destination: z.string().trim().nullable().optional(),
  amountClaimed: z.number().min(0),
  proofUrl: z.string().trim().nullable().optional(),
  reason: z.string().trim().nullable().optional(),
});

export const approvalActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  comment: z.string().trim().nullable().optional(),
});

const payrollPeriodField = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Payroll period must be a month written as YYYY-MM");

// Only who and which month: the server works out every amount itself.
export const payrollCreateSchema = z.object({
  employeeId: z.string().uuid("A valid employee is required"),
  payrollPeriod: payrollPeriodField,
});

export const payrollRunSchema = z.object({
  payrollPeriod: payrollPeriodField,
});

export const salaryStructureCreateSchema = z
  .object({
    employeeId: z.string().uuid("A valid employee is required"),
    basicSalary: z.number().positive("Basic salary must be greater than 0").max(100_000_000),
    effectiveFrom: z.string().refine(isRealDate, "Effective from must be a real date"),
    effectiveTo: z.string().refine(isRealDate, "Effective to must be a real date").nullable().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((d) => !d.effectiveTo || d.effectiveTo >= d.effectiveFrom, {
    path: ["effectiveTo"],
    message: "Effective to cannot be before effective from",
  });

export const salaryComponentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  type: z.enum(["allowance", "deduction"], "Type must be allowance or deduction"),
  amount: z.coerce.number().min(0, "Amount must be 0 or more").max(100_000_000),
});

export const performanceReviewSchema = z.object({
  employeeId: z.string().uuid("A valid employee is required"),
  reviewPeriod: z.string().trim().min(1, "Review period is required").max(40),
  rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5").nullable().optional(),
  comments: z.string().trim().max(2000).nullable().optional(),
  status: z.string().trim().max(30).optional(),
});


export const membershipCreateSchema = z
  .object({
    email: z.string().trim().email().optional(),
    name: z.string().trim().optional(),
    userId: z.string().uuid().optional(),
    role: z.enum(["owner", "admin", "hr", "manager", "employee", "member"]),
    // Optional initial login password (stored hashed, never shown again).
    password: z.string().min(12).max(128).optional(),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.userId), {
    message: "email or userId is required",
    path: ["email"],
  });

export const systemSettingsUpdateSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    timezone: z.string().trim().min(1).optional(),
    language: z.string().trim().min(1).optional(),
    dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional(),
    notifyPayroll: z.boolean().optional(),
    notifyLeave: z.boolean().optional(),
    notifySystem: z.boolean().optional(),
    leaveCountNonWorkingDays: z.boolean().optional(),
    shiftStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour)").optional(),
    graceMinutes: z.number().int().min(0).max(180).optional(),
    halfDayAfter: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour)").optional(),
    minFullDayHours: z.number().min(0).max(12).optional(),
  })
  .strict();

// Empty, or a full http(s) address. Blocks "javascript:" and similar.
export const httpUrl = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true;

    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a full web address starting with http:// or https://");

export const companyUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  website: httpUrl.nullable().optional(),
  address: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  logo: httpUrl.nullable().optional(),
});

export function formatZodError(error: z.ZodError) {
  return error.flatten();
}


export const holidaySchema = z.object({
  name: z.string().trim().min(1, "Holiday name is required").max(120),
  date: z.string().refine(isRealDate, "Enter a real date (YYYY-MM-DD)"),
  type: z.enum(["public", "optional", "company"]).default("public"),
  description: z.string().trim().nullable().optional(),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  body: z.string().trim().min(1, "Message is required").max(5000),
  pinned: z.boolean().optional(),
});

const isoDate = z.string().refine(isRealDate, "Enter a real date (YYYY-MM-DD)");

export const EXPENSE_CATEGORIES = [
  "travel",
  "food",
  "accommodation",
  "equipment",
  "internet",
  "other",
] as const;

export const expenseCreateSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(10_000_000),
  expenseDate: isoDate.refine(
    (d) => d <= new Date().toISOString().slice(0, 10),
    "Expense date cannot be in the future",
  ),
  description: z.string().trim().max(500).nullable().optional(),
});

export const expenseReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "paid"]),
  reviewNote: z.string().trim().max(500).nullable().optional(),
});

export const jobCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  departmentId: z.string().uuid().nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  openings: z.coerce.number().int().min(1).max(500).default(1),
  description: z.string().trim().max(3000).nullable().optional(),
});

export const jobUpdateSchema = z.object({
  status: z.enum(["open", "closed"]),
});

export const CANDIDATE_STAGES = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

export const candidateCreateSchema = z.object({
  jobId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Valid email is required"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9][0-9 ()-]{6,19})?$/, "Phone must be 7 to 20 digits")
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const candidateUpdateSchema = z.object({
  stage: z.enum(CANDIDATE_STAGES).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const onboardingStartSchema = z.object({
  employeeId: z.string().uuid(),
  kind: z.enum(["onboarding", "offboarding"]).default("onboarding"),
});

export const onboardingTaskCreateSchema = z.object({
  employeeId: z.string().uuid(),
  kind: z.enum(["onboarding", "offboarding"]).default("onboarding"),
  title: z.string().trim().min(1).max(200),
  dueDate: isoDate.nullable().optional(),
});

export const onboardingTaskUpdateSchema = z.object({
  done: z.boolean(),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const shiftCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  startTime: hhmm,
  endTime: hhmm,
});

export const shiftAssignSchema = z.object({
  employeeId: z.string().uuid(),
  // null clears the day.
  shiftId: z.string().uuid().nullable(),
  date: isoDate,
});

export const ticketCreateSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(150),
  category: z.enum(["payroll", "leave", "it", "policy", "other"]).default("other"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  description: z.string().trim().min(1, "Describe the issue").max(3000),
});

export const ticketUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

export const ticketCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

// Live presence on the Workplace page: where you work, and short breaks.
export const WORK_MODES = ["office", "remote"] as const;

export const presenceStatusSchema = z
  .object({
    workMode: z.enum(WORK_MODES).optional(),
    status: z.enum(["working", "lunch", "break", "away"]).optional(),
    minutes: z.number().int().min(5).max(180).optional(),
  })
  .refine((d) => d.workMode || d.status, "Choose a work mode or a status");

export const meetingCreateSchema = z.object({
  title: z.string().trim().min(1, "Give the meeting a title").max(120, "Title is too long"),
  description: z.string().trim().max(1000).nullable().optional(),
  startsAt: z.string().datetime({ message: "Choose a start date and time" }),
  durationMinutes: z.number().int().min(15, "At least 15 minutes").max(480, "At most 8 hours"),
  attendeeIds: z.array(z.string().uuid()).max(50, "At most 50 invitees"),
});

export const instantMeetingSchema = z.object({
  attendeeIds: z.array(z.string().uuid()).max(50).default([]),
  title: z.string().trim().max(120).optional(),
});
