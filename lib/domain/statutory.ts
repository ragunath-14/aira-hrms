import type { PtSlab, StatutoryConfig } from "@/lib/config/statutory";

// Pure calculators for statutory payroll. Nothing here touches the database or
// the clock, so each rule can be checked on its own.

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const rupees = (n: number) => Math.round(n);

export type StatutoryProfile = {
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  taxRegime: "new" | "old";
  declaredDeductions: number;
};

export const DEFAULT_PROFILE: StatutoryProfile = {
  pfApplicable: true,
  esiApplicable: true,
  ptApplicable: true,
  taxRegime: "new",
  declaredDeductions: 0,
};

// What was already paid to this employee earlier in the same financial year.
export type YearToDate = {
  gross: number;
  pfEmployee: number;
  professionalTax: number;
  tds: number;
};

export const NO_HISTORY: YearToDate = { gross: 0, pfEmployee: 0, professionalTax: 0, tds: 0 };

// ---- Provident fund --------------------------------------------------------

export function computePf(basic: number, config: StatutoryConfig["pf"], applicable: boolean) {
  if (!config.enabled || !applicable || basic <= 0) {
    return { wage: 0, employee: 0, employer: 0 };
  }

  const wage = config.capWage ? Math.min(basic, config.wageCeiling) : basic;

  return {
    wage: cents(wage),
    employee: rupees((wage * config.employeeRate) / 100),
    employer: rupees((wage * config.employerRate) / 100),
  };
}

// The employer's share is split between the pension scheme (EPS, on wages up to
// the ceiling) and the provident fund proper. The EPFO return asks for both.
export function splitEmployerPf(
  pfWage: number,
  pfEmployer: number,
  config: StatutoryConfig["pf"],
) {
  const epsWage = Math.min(pfWage, config.wageCeiling);
  const eps = Math.min(pfEmployer, rupees((epsWage * config.epsRate) / 100));

  return { epsWage, eps, epf: pfEmployer - eps };
}

// ---- ESI -------------------------------------------------------------------

// ESI is charged on gross pay, only while gross is within the limit, and is
// rounded up to the next rupee.
export function computeEsi(gross: number, config: StatutoryConfig["esi"], applicable: boolean) {
  if (!config.enabled || !applicable || gross <= 0 || gross > config.grossLimit) {
    return { wage: 0, employee: 0, employer: 0 };
  }

  const up = (rate: number) => Math.ceil(Number(((gross * rate) / 100).toFixed(6)));

  return {
    wage: cents(gross),
    employee: up(config.employeeRate),
    employer: up(config.employerRate),
  };
}

// ---- Professional tax ------------------------------------------------------

export function slabAmount(gross: number, slabs: PtSlab[]) {
  const ordered = [...slabs].sort(
    (a, b) => (a.upTo ?? Number.POSITIVE_INFINITY) - (b.upTo ?? Number.POSITIVE_INFINITY),
  );

  for (const slab of ordered) {
    if (slab.upTo === null || gross <= slab.upTo) return slab.amount;
  }

  return 0;
}

export function computePt(gross: number, config: StatutoryConfig["pt"], applicable: boolean) {
  if (!config.enabled || !applicable || gross <= 0) return 0;

  return cents(slabAmount(gross, config.slabs));
}

// ---- Income tax (TDS on salary) -------------------------------------------

type TaxSlab = { upTo: number; rate: number };

// New regime (the default), financial year 2025-26 onward.
const NEW_REGIME = {
  standardDeduction: 75_000,
  slabs: [
    { upTo: 400_000, rate: 0 },
    { upTo: 800_000, rate: 5 },
    { upTo: 1_200_000, rate: 10 },
    { upTo: 1_600_000, rate: 15 },
    { upTo: 2_000_000, rate: 20 },
    { upTo: 2_400_000, rate: 25 },
    { upTo: Number.POSITIVE_INFINITY, rate: 30 },
  ] as TaxSlab[],
  // Section 87A: no tax when taxable income is within this, with marginal relief
  // just above it.
  rebateLimit: 1_200_000,
};

const OLD_REGIME = {
  standardDeduction: 50_000,
  slabs: [
    { upTo: 250_000, rate: 0 },
    { upTo: 500_000, rate: 5 },
    { upTo: 1_000_000, rate: 20 },
    { upTo: Number.POSITIVE_INFINITY, rate: 30 },
  ] as TaxSlab[],
  rebateLimit: 500_000,
};

const CESS_PERCENT = 4;

function taxOnSlabs(taxable: number, slabs: TaxSlab[]) {
  let tax = 0;
  let lower = 0;

  for (const slab of slabs) {
    if (taxable > lower) {
      tax += ((Math.min(taxable, slab.upTo) - lower) * slab.rate) / 100;
    }
    lower = slab.upTo;
  }

  return tax;
}

// Yearly tax for a taxable income, including the 87A rebate and the 4% cess.
// Surcharge (incomes above Rs 50 lakh) is not applied.
export function annualIncomeTax(taxable: number, regime: "new" | "old") {
  const rules = regime === "old" ? OLD_REGIME : NEW_REGIME;
  let tax = taxOnSlabs(Math.max(0, taxable), rules.slabs);

  if (taxable <= rules.rebateLimit) {
    tax = 0;
  } else if (regime === "new") {
    // Marginal relief: never pay more than the income above the rebate limit.
    tax = Math.min(tax, taxable - rules.rebateLimit);
  }

  return rupees(tax * (1 + CESS_PERCENT / 100));
}

// Months of the financial year (April to March) left to pay, counting this one.
export function monthsLeftInYear(period: string) {
  const month = Number(period.slice(5, 7));

  return month >= 4 ? 16 - month : 4 - month;
}

// Financial year a payroll month belongs to, as [first month, this month).
export function financialYearStart(period: string) {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));

  return `${month >= 4 ? year : year - 1}-04`;
}

// Monthly TDS the standard way: project the year's pay (what was paid so far
// plus this month's pay for every month left), work out the year's tax, and
// spread what is still owed over the months left. Mid-year joiners, raises and
// regime changes correct themselves in later months.
export function computeTds(input: {
  period: string;
  profile: StatutoryProfile;
  gross: number;
  pfEmployee: number;
  professionalTax: number;
  history: YearToDate;
}) {
  const left = monthsLeftInYear(input.period);
  const { history, profile } = input;

  const annualGross = history.gross + input.gross * left;
  const annualPf = history.pfEmployee + input.pfEmployee * left;
  const annualPt = history.professionalTax + input.professionalTax * left;

  const rules = profile.taxRegime === "old" ? OLD_REGIME : NEW_REGIME;
  const deductions =
    profile.taxRegime === "old"
      ? rules.standardDeduction + annualPf + annualPt + profile.declaredDeductions
      : rules.standardDeduction;

  const taxable = Math.max(0, annualGross - deductions);
  const yearlyTax = annualIncomeTax(taxable, profile.taxRegime);
  const stillOwed = Math.max(0, yearlyTax - history.tds);

  return {
    tds: cents(rupees(stillOwed / left)),
    yearlyTax,
    taxable: rupees(taxable),
  };
}

// ---- Everything for one employee-month -------------------------------------

export function computeStatutory(input: {
  config: StatutoryConfig;
  period: string;
  basic: number;
  gross: number;
  profile: StatutoryProfile;
  history: YearToDate;
}) {
  const { config, profile, basic, gross } = input;

  const pf = computePf(basic, config.pf, profile.pfApplicable);
  const esi = computeEsi(gross, config.esi, profile.esiApplicable);
  const professionalTax = computePt(gross, config.pt, profile.ptApplicable);

  const tds = config.tds.enabled
    ? computeTds({
        period: input.period,
        profile,
        gross,
        pfEmployee: pf.employee,
        professionalTax,
        history: input.history,
      }).tds
    : 0;

  return {
    pfWage: pf.wage,
    pfEmployee: pf.employee,
    pfEmployer: pf.employer,
    esiWage: esi.wage,
    esiEmployee: esi.employee,
    esiEmployer: esi.employer,
    professionalTax,
    tds,
    // What comes off the employee's pay. Employer contributions are a cost to
    // the company and are not deducted.
    employeeDeductions: cents(pf.employee + esi.employee + professionalTax + tds),
  };
}
