import banksRaw from '@/assets/ng-banks.json';

export type NgBank = { code: string; name: string; search: string };

function toTitleCase(s: string): string {
  const cleaned = (s || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  // Keep common abbreviations uppercased
  const keepUpper = new Set(['MFB', 'MFBANK', 'PLC', 'PSB', 'UBA', 'GTBANK', 'GTB', 'FCMB', 'NIRSAL', 'NPF', 'CBN', 'TSA']);
  return cleaned
    .split(' ')
    .map((w) => {
      const up = w.toUpperCase();
      if (keepUpper.has(up)) return up;
      // keep mixed-case tokens (e.g. Paystack-Titan) as-is
      if (/[a-z]/.test(w) && /[A-Z]/.test(w)) return w;
      return up.charAt(0) + up.slice(1).toLowerCase();
    })
    .join(' ');
}

export const NG_BANKS: NgBank[] = (banksRaw as Array<{ value?: string; label?: string }>)
  .map((b) => {
    const code = String(b?.value ?? '').trim();
    const name = toTitleCase(String(b?.label ?? '').trim());
    const search = `${name} ${code}`.toLowerCase();
    return { code, name, search };
  })
  .filter((b) => b.code && b.name)
  .sort((a, b) => a.name.localeCompare(b.name));

