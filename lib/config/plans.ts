// Subscription plans. A plan is a named set of limits; the platform owner can
// still give one company different numbers (see tenants.plan_* columns).
//
// There is no payment processing here: the platform owner sets each company's
// plan and expiry by hand. Add a payment provider later by having it call the
// same "set plan" path.

export type PlanId = "free" | "starter" | "growth" | "enterprise";

export type Plan = {
  id: PlanId;
  label: string;
  // People = employees and logins. null means unlimited.
  employeeLimit: number | null;
  storageMb: number;
  blurb: string;
};

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", label: "Free", employeeLimit: 10, storageMb: 100, blurb: "Up to 10 people, 100 MB of documents" },
  starter: { id: "starter", label: "Starter", employeeLimit: 50, storageMb: 1024, blurb: "Up to 50 people, 1 GB of documents" },
  growth: { id: "growth", label: "Growth", employeeLimit: 250, storageMb: 5 * 1024, blurb: "Up to 250 people, 5 GB of documents" },
  enterprise: { id: "enterprise", label: "Enterprise", employeeLimit: null, storageMb: 50 * 1024, blurb: "Unlimited people, 50 GB of documents" },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const DEFAULT_PLAN: PlanId = "starter";

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS;
}

export type PlanFields = {
  plan: string;
  planEmployeeLimit: number | null;
  planStorageMb: number | null;
  planExpiresAt: Date | null;
};

// The limits that apply to a company: the plan's, unless overridden.
export function resolveLimits(tenant: PlanFields, now = new Date()) {
  const plan = PLANS[isPlanId(tenant.plan) ? tenant.plan : DEFAULT_PLAN];
  const expiresAt = tenant.planExpiresAt ? new Date(tenant.planExpiresAt) : null;

  return {
    plan,
    employeeLimit: tenant.planEmployeeLimit ?? plan.employeeLimit,
    storageBytes: (tenant.planStorageMb ?? plan.storageMb) * 1024 * 1024,
    expiresAt,
    expired: expiresAt !== null && expiresAt.getTime() < now.getTime(),
  };
}
