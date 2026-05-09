export function parseUsdAmount(input: unknown): number {
  const raw = typeof input === 'string' ? input : Array.isArray(input) ? input[0] : '';
  const n = Number(String(raw ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function fmtMoney(n: number, currencySymbol = '$'): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${currencySymbol}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

