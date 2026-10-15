// Statutory payroll rules (India): provident fund, ESI, professional tax and
// income-tax TDS. The rates are company settings (Settings -> Payroll
// compliance) because they change over time and PT differs by state; the
// defaults below are the rules at the time of writing.
//
// Anything not switched on stays off, so payroll behaves as before until a
// company opts in.

export type PtSlab = {
  // Monthly gross up to and including this amount; null means "and above".
  upTo: number | null;
  amount: number;
};

export type StatutoryConfig = {
  pf: {
    enabled: boolean;
    employeeRate: number; // % of PF wage
    employerRate: number; // % of PF wage
    wageCeiling: number; // monthly PF wage ceiling
    capWage: boolean; // true: contribute on the ceiling only (statutory minimum)
    epsRate: number; // % of wage (capped at the ceiling) that goes to the pension scheme
  };
  esi: {
    enabled: boolean;
    employeeRate: number; // % of gross
    employerRate: number; // % of gross
    grossLimit: number; // monthly gross above which ESI no longer applies
  };
  pt: {
    enabled: boolean;
    state: string;
    slabs: PtSlab[];
  };
  tds: {
    enabled: boolean;
  };
  // Labour Welfare Fund: a fixed amount taken in the chosen months (many states
  // collect it once or twice a year). Rates differ by state, so there are no
  // presets: enter the amounts your state sets.
  lwf: {
    enabled: boolean;
    employeeAmount: number;
    employerAmount: number;
    // Calendar months (1-12) in which it is collected.
    months: number[];
  };
};

export const PT_PRESETS: Record<string, PtSlab[]> = {
  // Starting points only: PT rules and slabs are set by each state and are
  // revised from time to time, so confirm them for your state before use.
  "Tamil Nadu": [
    { upTo: 21000, amount: 0 },
    { upTo: 30000, amount: 22.5 },
    { upTo: 45000, amount: 52.5 },
    { upTo: 60000, amount: 115 },
    { upTo: 75000, amount: 171 },
    { upTo: null, amount: 208 },
  ],
  Karnataka: [
    { upTo: 24999, amount: 0 },
    { upTo: null, amount: 200 },
  ],
  Maharashtra: [
    { upTo: 7500, amount: 0 },
    { upTo: 10000, amount: 175 },
    { upTo: null, amount: 200 },
  ],
  Telangana: [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: null, amount: 200 },
  ],
  "Andhra Pradesh": [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: null, amount: 200 },
  ],
  "West Bengal": [
    { upTo: 10000, amount: 0 },
    { upTo: 15000, amount: 110 },
    { upTo: 25000, amount: 130 },
    { upTo: 40000, amount: 150 },
    { upTo: null, amount: 200 },
  ],
  Gujarat: [
    { upTo: 12000, amount: 0 },
    { upTo: null, amount: 200 },
  ],
};

export const STATUTORY_DEFAULTS: StatutoryConfig = {
  pf: {
    enabled: false,
    employeeRate: 12,
    employerRate: 12,
    wageCeiling: 15000,
    capWage: true,
    epsRate: 8.33,
  },
  esi: {
    enabled: false,
    employeeRate: 0.75,
    employerRate: 3.25,
    grossLimit: 21000,
  },
  pt: {
    enabled: false,
    state: "Tamil Nadu",
    slabs: PT_PRESETS["Tamil Nadu"],
  },
  tds: {
    enabled: false,
  },
  lwf: {
    enabled: false,
    employeeAmount: 0,
    employerAmount: 0,
    months: [12],
  },
};

// Merges what a company stored over the defaults, group by group, so a company
// that has only ever set PF still gets sensible ESI / PT / TDS defaults.
export function resolveStatutory(settings: unknown): StatutoryConfig {
  const stored =
    settings && typeof settings === "object"
      ? ((settings as Record<string, unknown>).statutory as Partial<Record<string, unknown>> | undefined)
      : undefined;

  const group = <K extends keyof StatutoryConfig>(key: K): StatutoryConfig[K] => {
    const value = stored?.[key];

    return {
      ...STATUTORY_DEFAULTS[key],
      ...(value && typeof value === "object" ? value : {}),
    } as StatutoryConfig[K];
  };

  return { pf: group("pf"), esi: group("esi"), pt: group("pt"), tds: group("tds"), lwf: group("lwf") };
}

export function anyStatutoryEnabled(config: StatutoryConfig) {
  return (
    config.pf.enabled || config.esi.enabled || config.pt.enabled || config.tds.enabled || config.lwf.enabled
  );
}
