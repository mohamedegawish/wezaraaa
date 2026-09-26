/** مبلغ بالجنيه → رقم بالمليار بلا كسر زائد: 12e9 → «١٢» (ar) / "12" (en)، 12.5e9 → «١٢٫٥». */
export function formatBillions(egp: number | undefined, isAr: boolean): string {
  return ((egp ?? 0) / 1e9).toLocaleString(isAr ? 'ar-EG' : 'en-US', { maximumFractionDigits: 1 });
}

/** مبلغ بالجنيه بصيغة مقروءة: 12.5e9 → «١٢٫٥ مليار جنيه»، 1e8 → «١٠٠ مليون جنيه»، 5e5 → «٥٠٠ ألف جنيه». */
export function formatEGP(egp: number | undefined, isAr: boolean): string {
  const n = Number(egp) || 0;
  const loc = isAr ? 'ar-EG' : 'en-US';
  const num = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 2 });
  const abs = Math.abs(n);
  if (abs >= 1e9) return isAr ? `${num(n / 1e9)} مليار جنيه` : `EGP ${num(n / 1e9)} billion`;
  if (abs >= 1e6) return isAr ? `${num(n / 1e6)} مليون جنيه` : `EGP ${num(n / 1e6)} million`;
  if (abs >= 1e3) return isAr ? `${num(n / 1e3)} ألف جنيه` : `EGP ${num(n / 1e3)} thousand`;
  return isAr ? `${num(n)} جنيه` : `EGP ${num(n)}`;
}
