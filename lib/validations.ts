import { z } from "zod";

const optionalUuid = z
  .string()
  .uuid()
  .nullable()
  .optional();

export const employeeCreateSchema = z.object({
  employeeCode: z.string().trim().min(1, "Employee code is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().nullable().optional(),
  email: z.string().trim().email("Valid email is required"),
  phone: z.string().trim().nullable().optional(),
  dateOfJoining: z.string().nullable().optional(),
  departmentId: optionalUuid,
  designationId: optionalUuid,
  locationId: optionalUuid,
  managerId: optionalUuid,
  userId: optionalUuid,
  status: z.enum(["active", "inactive", "terminated"]).optional(),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

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

export const payrollCreateSchema = z.object({
  employeeId: z.string().uuid("A valid employee is required"),
  payrollPeriod: z.string().trim().min(1, "payrollPeriod is required"),
  basicSalary: z.number(),
  totalAllowances: z.number().optional(),
  totalDeductions: z.number().optional(),
  netSalary: z.number(),
  status: z.string().trim().optional(),
});

export const salaryStructureCreateSchema = z.object({
  employeeId: z.string().uuid("A valid employee is required"),
  basicSalary: z.number(),
  effectiveFrom: z.string().min(1, "effectiveFrom is required"),
  effectiveTo: z.string().nullable().optional(),
  status: z.string().trim().optional(),
});

export const membershipCreateSchema = z
  .object({
    email: z.string().trim().email().optional(),
    name: z.string().trim().optional(),
    userId: z.string().uuid().optional(),
    role: z.enum(["owner", "admin", "hr", "manager", "employee", "member"]),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.userId), {
    message: "email or userId is required",
    path: ["email"],
  });

export const companyUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  website: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  logo: z.string().trim().nullable().optional(),
});

export function formatZodError(error: z.ZodError) {
  return error.flatten();
}
