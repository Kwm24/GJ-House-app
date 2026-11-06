// Date helpers for the per-account lobby dashboards.

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fmtShortDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GH", { day: "numeric", month: "short" });
}

export function periodLabel(period) {
  if (!period || period.year == null) return "all time";
  return new Date(period.year, period.month, 1).toLocaleDateString("en-GH", { month: "long", year: "numeric" });
}
