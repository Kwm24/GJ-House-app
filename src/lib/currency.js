export function formatGHS(amount) {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? Math.abs(n) : 0;
  return `GH₵ ${safe.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
