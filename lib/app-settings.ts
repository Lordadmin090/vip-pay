import { supabase } from '@/lib/supabase';

/** Fallback when `app_settings` row is missing or Supabase is unreachable. */
export const DEFAULT_COINS_PER_USD = 1000;

export type AppPlatformSettings = {
  coins_per_usd: number;
  watch_reward_coins: number;
  min_withdraw_coins: number;
  min_withdraw_usd: number;
  gas_fee: number;
  gas_fee_topup_usd: number;
  min_convert_coins: number;
  max_convert_coins: number;
  min_topup_usd: number;
  ngn_per_usd: number;
  ghs_per_usd: number;
  ngn_bank_name: string;
  ngn_account_number: string;
  ngn_account_name: string;
  ghs_bank_name: string;
  ghs_merchant_number: string;
  ghs_account_name: string;
  usdt_network: string;
  usdt_wallet_address: string;
};

export const DEFAULT_APP_SETTINGS: AppPlatformSettings = {
  coins_per_usd: DEFAULT_COINS_PER_USD,
  watch_reward_coins: 50,
  min_withdraw_coins: 1000,
  min_withdraw_usd: 1,
  gas_fee: 2,
  gas_fee_topup_usd: 5,
  min_convert_coins: 1000,
  max_convert_coins: 5_000_000,
  min_topup_usd: 1,
  ngn_per_usd: 1600,
  ghs_per_usd: 15,
  ngn_bank_name: 'Wema Bank',
  ngn_account_number: '0123456789',
  ngn_account_name: 'VIBEPAY GLOBAL VENTURES',
  ghs_bank_name: 'VibePay Africa Ltd',
  ghs_merchant_number: '0541 234 567',
  ghs_account_name: 'VIDPAY',
  usdt_network: 'TRC20',
  usdt_wallet_address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
};

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function coinsPerUsdFromAdminValue(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // Admin sometimes stores USD-per-coin (e.g. 0.01 means 100 coins = $1).
  // Our app expects coins-per-$1. Convert when value < 1.
  if (n > 0 && n < 1) return 1 / n;
  return n;
}

function numNonNegative(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function str(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : fallback;
}

function isMissingTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const msg = (e?.message ?? '').toLowerCase();
  if (code === '42P01') return true;
  return msg.includes('does not exist') || msg.includes('undefined_table') || msg.includes('relation') || msg.includes('schema cache');
}

/**
 * Admin-tunable platform settings from `public.app_settings` (id = 1).
 * Run `supabase/sql/app_settings.sql` and `app_settings_extend.sql` in the SQL Editor.
 */
export async function fetchAppSettings(): Promise<AppPlatformSettings> {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();

  if (error) {
    // Missing table is expected on some schemas (e.g. MVP). Default silently.
    if (__DEV__ && !isMissingTableError(error)) {
      // eslint-disable-next-line no-console
      console.warn('[app_settings]', error.message);
    }
    return { ...DEFAULT_APP_SETTINGS };
  }

  if (!data) return { ...DEFAULT_APP_SETTINGS };

  const row = data as Record<string, unknown>;
  const gasTopup =
    // preferred new column
    row.gas_fee_topup_usd ??
    // accept alternate legacy names if admin created a different column
    (row as any).gas_topup_usd ??
    (row as any).gas_fee_topup ??
    (row as any).gas_topup_amount ??
    // last-resort: if admin only set `min_topup_usd`, reuse it
    row.min_topup_usd;
  return {
    coins_per_usd: coinsPerUsdFromAdminValue(row.coins_per_usd, DEFAULT_COINS_PER_USD),
    watch_reward_coins: numNonNegative(row.watch_reward_coins, DEFAULT_APP_SETTINGS.watch_reward_coins),
    min_withdraw_coins: num(row.min_withdraw_coins, DEFAULT_APP_SETTINGS.min_withdraw_coins),
    min_withdraw_usd: num(row.min_withdraw_usd, DEFAULT_APP_SETTINGS.min_withdraw_usd),
    gas_fee: numNonNegative(row.gas_fee, DEFAULT_APP_SETTINGS.gas_fee),
    // Admin-controlled gas top-up amount (fixed); if not present, fall back.
    gas_fee_topup_usd: num(gasTopup, DEFAULT_APP_SETTINGS.gas_fee_topup_usd),
    min_convert_coins: num(row.min_convert_coins, DEFAULT_APP_SETTINGS.min_convert_coins),
    max_convert_coins: num(row.max_convert_coins, DEFAULT_APP_SETTINGS.max_convert_coins),
    min_topup_usd: num(row.min_topup_usd, DEFAULT_APP_SETTINGS.min_topup_usd),
    ngn_per_usd: num(row.ngn_per_usd, DEFAULT_APP_SETTINGS.ngn_per_usd),
    ghs_per_usd: num(row.ghs_per_usd, DEFAULT_APP_SETTINGS.ghs_per_usd),
    ngn_bank_name: str(row.ngn_bank_name, DEFAULT_APP_SETTINGS.ngn_bank_name),
    ngn_account_number: str(row.ngn_account_number, DEFAULT_APP_SETTINGS.ngn_account_number),
    ngn_account_name: str(row.ngn_account_name, DEFAULT_APP_SETTINGS.ngn_account_name),
    ghs_bank_name: str(row.ghs_bank_name, DEFAULT_APP_SETTINGS.ghs_bank_name),
    ghs_merchant_number: str(row.ghs_merchant_number, DEFAULT_APP_SETTINGS.ghs_merchant_number),
    ghs_account_name: str(row.ghs_account_name, DEFAULT_APP_SETTINGS.ghs_account_name),
    usdt_network: str(row.usdt_network, DEFAULT_APP_SETTINGS.usdt_network),
    usdt_wallet_address: str(row.usdt_wallet_address, DEFAULT_APP_SETTINGS.usdt_wallet_address),
  };
}

/** @deprecated Prefer fetchAppSettings(); kept for narrow imports */
export async function fetchCoinsPerUsd(): Promise<number> {
  const s = await fetchAppSettings();
  return s.coins_per_usd;
}
