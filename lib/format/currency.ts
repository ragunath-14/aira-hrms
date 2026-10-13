// All money in the app is Indian rupees, shown with lakh/crore grouping
// (₹12,34,567). Whole amounts drop the decimals; anything else always shows
// two (₹1,234.50, never ₹1,234.5).
const whole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const fractional = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(value: unknown) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return whole.format(0);
  }

  return Number.isInteger(n) ? whole.format(n) : fractional.format(n);
}
