import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PayslipData = {
  company: { name: string; address?: string | null; city?: string | null; state?: string | null; country?: string | null; phone?: string | null; email?: string | null };
  employee: {
    name: string;
    code: string;
    email: string;
    designation?: string | null;
    department?: string | null;
    location?: string | null;
    joinedOn?: string | null;
    pan?: string | null; // already masked
    uan?: string | null;
  };
  period: string; // YYYY-MM
  generatedOn: string;
  basic: number;
  allowances: number;
  deductions: number;
  net: number;
  // Itemised lines, only when they add up to the stored totals.
  allowanceItems?: { name: string; amount: number }[];
  deductionItems?: { name: string; amount: number }[];
  // Statutory deductions taken from pay (included in `deductions`), and what
  // the employer pays on top (not deducted).
  statutory?: {
    pfEmployee: number;
    esiEmployee: number;
    professionalTax: number;
    tds: number;
    pfEmployer: number;
    esiEmployer: number;
    lwfEmployee?: number;
  };
  // Days paid, when pay follows attendance.
  days?: { inPeriod: number; paid: number; lop: number };
  overtime?: { hours: number; pay: number };
  // One-off earnings (bonus, arrears) and deductions that make up part of the
  // totals above, itemised.
  extraEarnings?: { label: string; amount: number }[];
  extraDeductions?: { label: string; amount: number }[];
};

const inr = (n: number) =>
  `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

// "Thirty Six Thousand Four Hundred Rupees Only" (Indian grouping).
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const units: [number, string][] = [
    [10_000_000, "Crore"],
    [100_000, "Lakh"],
    [1_000, "Thousand"],
  ];

  let rest = rupees;
  const words: string[] = [];

  for (const [size, label] of units) {
    if (rest >= size) {
      words.push(`${below1000(Math.floor(rest / size))} ${label}`);
      rest %= size;
    }
  }
  if (rest > 0) words.push(below1000(rest));

  let text = `${words.join(" ") || "Zero"} Rupees`;
  if (paise > 0) text += ` and ${below1000(paise)} Paise`;

  return `${text} Only`;
}

function monthName(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const INK = rgb(0.12, 0.14, 0.2);
const MUTED = rgb(0.42, 0.45, 0.52);
const LINE = rgb(0.85, 0.87, 0.9);
const BLUE = rgb(0.15, 0.39, 0.92);

// Builds a one-page A4 payslip. Uses only the built-in PDF fonts, so it needs
// no font files and runs anywhere Node does.
export async function buildPayslipPdf(data: PayslipData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Payslip ${data.period} - ${data.employee.name}`);
  pdf.setProducer("AIRA HRMS");

  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const left = 48;
  const right = 595.28 - 48;
  const width = right - left;
  let y = 841.89 - 56;

  const text = (s: string, x: number, yy: number, size = 10, font: PDFFont = regular, color = INK) =>
    page.drawText(s, { x, y: yy, size, font, color });

  const textRight = (s: string, xRight: number, yy: number, size = 10, font: PDFFont = regular, color = INK) =>
    text(s, xRight - font.widthOfTextAtSize(s, size), yy, size, font, color);

  const rule = (yy: number, thickness = 0.8) =>
    page.drawLine({ start: { x: left, y: yy }, end: { x: right, y: yy }, thickness, color: LINE });

  // Header
  text(data.company.name, left, y, 17, bold);
  y -= 16;
  const where = [data.company.address, data.company.city, data.company.state, data.company.country].filter(Boolean).join(", ");
  if (where) { text(where, left, y, 9, regular, MUTED); y -= 12; }
  const contact = [data.company.phone, data.company.email].filter(Boolean).join("  |  ");
  if (contact) { text(contact, left, y, 9, regular, MUTED); y -= 12; }

  y -= 30;
  page.drawRectangle({ x: left, y: y - 6, width, height: 30, color: rgb(0.94, 0.96, 1) });
  text("PAYSLIP", left + 12, y + 3, 13, bold, BLUE);
  textRight(monthName(data.period), right - 12, y + 3, 12, bold);
  y -= 34;

  // Employee details (two columns)
  const detail = (label: string, value: string, x: number, yy: number) => {
    text(label, x, yy, 8, regular, MUTED);
    text(value || "-", x, yy - 12, 10, bold);
  };
  const colB = left + width / 2 + 10;
  detail("Employee", data.employee.name, left, y);
  detail("Employee code", data.employee.code, colB, y);
  y -= 34;
  detail("Designation", data.employee.designation ?? "-", left, y);
  detail("Department", data.employee.department ?? "-", colB, y);
  y -= 34;
  detail("Work email", data.employee.email, left, y);
  detail("Date of joining", data.employee.joinedOn ?? "-", colB, y);
  y -= 34;
  if (data.employee.location) {
    detail("Location", data.employee.location, left, y);
    y -= 34;
  }
  if (data.employee.pan || data.employee.uan) {
    detail("PAN", data.employee.pan ?? "-", left, y);
    detail("UAN", data.employee.uan ?? "-", colB, y);
    y -= 34;
  }

  if (data.days) {
    detail("Days paid", `${data.days.paid} of ${data.days.inPeriod}`, left, y);
    detail("Loss of pay days", String(data.days.lop), colB, y);
    y -= 34;
  }

  rule(y + 8);
  y -= 8;

  // Earnings and deductions
  const amountX = right;
  const sectionTitle = (title: string) => {
    text(title.toUpperCase(), left, y, 9, bold, MUTED);
    textRight("AMOUNT", amountX, y, 9, bold, MUTED);
    y -= 8;
    rule(y);
    y -= 16;
  };
  const line = (label: string, amount: number, strong = false) => {
    text(label, left, y, 10.5, strong ? bold : regular);
    textRight(inr(amount), amountX, y, 10.5, strong ? bold : regular);
    y -= 17;
  };

  sectionTitle("Earnings");
  line("Basic salary", data.basic);
  const otherEarningsTotal =
    (data.overtime?.pay ?? 0) + (data.extraEarnings ?? []).reduce((t, e) => t + e.amount, 0);
  const componentAllowances = Math.round((data.allowances - otherEarningsTotal) * 100) / 100;
  if (data.allowanceItems && data.allowanceItems.length > 0) {
    for (const item of data.allowanceItems) line(item.name, item.amount);
  } else if (componentAllowances > 0) {
    line("Allowances", componentAllowances);
  }
  if (data.overtime && data.overtime.pay > 0) {
    line(`Overtime (${data.overtime.hours} h)`, data.overtime.pay);
  }
  for (const item of data.extraEarnings ?? []) line(item.label, item.amount);
  rule(y + 10);
  y -= 2;
  line("Gross earnings", data.basic + data.allowances, true);

  y -= 10;
  sectionTitle("Deductions");
  const st = data.statutory;
  const statutoryLines: [string, number][] = st
    ? [
        ["Provident fund (employee)", st.pfEmployee],
        ["ESI (employee)", st.esiEmployee],
        ["Professional tax", st.professionalTax],
        ["Income tax (TDS)", st.tds],
        ["Labour welfare fund", st.lwfEmployee ?? 0],
      ]
    : [];
  const extras = data.extraDeductions ?? [];
  const statutoryTotal =
    statutoryLines.reduce((t, [, amount]) => t + amount, 0) + extras.reduce((t, e) => t + e.amount, 0);
  const otherDeductions = Math.round((data.deductions - statutoryTotal) * 100) / 100;

  for (const [label, amount] of statutoryLines) {
    if (amount > 0) line(label, amount);
  }
  for (const item of extras) {
    if (item.amount > 0) line(item.label, item.amount);
  }
  if (data.deductionItems && data.deductionItems.length > 0) {
    for (const item of data.deductionItems) line(item.name, item.amount);
  } else if (otherDeductions > 0) {
    line(statutoryTotal > 0 ? "Other deductions" : "Deductions", otherDeductions);
  } else if (statutoryTotal === 0) {
    text("None", left, y, 10.5, regular, MUTED);
    y -= 17;
  }
  rule(y + 10);
  y -= 2;
  line("Total deductions", data.deductions, true);

  // Net pay
  y -= 30;
  page.drawRectangle({ x: left, y: y - 14, width, height: 44, color: BLUE });
  text("NET PAY", left + 14, y + 6, 11, bold, rgb(1, 1, 1));
  textRight(inr(data.net), right - 14, y + 3, 17, bold, rgb(1, 1, 1));
  y -= 36;
  text(amountInWords(data.net), left, y, 10, regular, MUTED);
  y -= 12;

  if (st && (st.pfEmployer > 0 || st.esiEmployer > 0)) {
    y -= 12;
    const parts = [
      st.pfEmployer > 0 ? `Provident fund ${inr(st.pfEmployer)}` : "",
      st.esiEmployer > 0 ? `ESI ${inr(st.esiEmployer)}` : "",
    ].filter(Boolean);
    text(`Employer contribution (paid by the company, not deducted): ${parts.join(", ")}`, left, y, 8.5, regular, MUTED);
  }

  // Footer
  footer(page, regular, data.generatedOn, left, right);

  return pdf.save();
}

function footer(page: PDFPage, font: PDFFont, generatedOn: string, left: number, right: number) {
  page.drawLine({ start: { x: left, y: 72 }, end: { x: right, y: 72 }, thickness: 0.8, color: LINE });
  page.drawText("This is a system generated payslip and does not need a signature.", {
    x: left, y: 56, size: 8.5, font, color: MUTED,
  });
  const stamp = `Generated on ${generatedOn}`;
  page.drawText(stamp, {
    x: right - font.widthOfTextAtSize(stamp, 8.5), y: 56, size: 8.5, font, color: MUTED,
  });
}
