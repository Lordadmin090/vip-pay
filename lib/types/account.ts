/** Shared account/wallet shapes — lives under `lib/` so `wallet-remote` / `wallet-store` never import from `hooks/` (avoids circular deps with `supabase`). */

export type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  country: string | null;
  is_verified: boolean;
};

/** Mirrors `public.users` (and legacy `wallets`) balance columns. */
export type WalletRow = {
  user_id: string;
  wallet_balance: number;
  usd_ready: number;
  coin_balance: number;
  scroll_points: number;
  gas_fee_balance: number;
};
