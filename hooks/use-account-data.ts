import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function isMissingTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const msg = (e?.message ?? '').toLowerCase();
  // Postgres: undefined_table = 42P01 (Supabase surfaces this for missing relations).
  if (code === '42P01') return true;
  return msg.includes('does not exist') || msg.includes('undefined_table') || msg.includes('relation') || msg.includes('schema cache');
}

export type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null; // kept for compatibility
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

function mapUsersRow(u: Record<string, unknown>, uid: string): WalletRow {
  return {
    user_id: uid,
    wallet_balance: Number(u.wallet_balance ?? 0),
    usd_ready: Number(u.usd_balance ?? 0),
    coin_balance: Number(u.coin_balance ?? 0),
    scroll_points: Number(u.sp_balance ?? 0),
    // Support both column names: `gas_fee_balance` (new) and `gas_fee` (legacy).
    gas_fee_balance: Number((u as any).gas_fee_balance ?? (u as any).gas_fee ?? 0),
  };
}

/** Legacy `wallets` table: `wallet_usd` is USD ready; `wallet_balance` is shop wallet (if added). */
function mapWalletsRow(w: Record<string, unknown>, uid: string): WalletRow {
  return {
    user_id: uid,
    wallet_balance: Number((w as any).wallet_balance ?? 0),
    usd_ready: Number((w as any).wallet_usd ?? (w as any).usd_ready ?? 0),
    coin_balance: Number(w.coin_balance ?? 0),
    scroll_points: Number(w.scroll_points ?? w.sp_balance ?? 0),
    gas_fee_balance: Number((w as any).gas_fee_balance ?? (w as any).gas_fee ?? 0),
  };
}

async function ensureLegacyProfileAndWallet(uid: string, email: string | null) {
  // Best-effort: if your DB trigger didn't create rows, create them from the client (RLS policies must allow).
  // Profiles
  await supabase
    .from('profiles')
    .upsert({ id: uid, email }, { onConflict: 'id' });

  // Wallets (legacy MVP schema)
  // IMPORTANT: do NOT upsert zero balances into an existing wallet row.
  // This function should only ensure a row exists; overwriting would "wipe" balances like scroll_points.
  await supabase
    .from('wallets')
    .upsert(
      {
        user_id: uid,
      },
      // `ignoreDuplicates` prevents updates on conflict (keeps existing balances intact).
      { onConflict: 'user_id', ignoreDuplicates: true } as any
    );
}

export function useAccountData() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setError(sessionError.message);
      setProfile(null);
      setWallet(null);
      setSession(null);
      setLoading(false);
      return;
    }
    setSession(sessionData.session ?? null);
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      setProfile(null);
      setWallet(null);
      setLoading(false);
      return;
    }

    // Prefer the MVP schema: `public.wallets` + `public.profiles` (matches your SQL).
    // Only fall back to `public.users` if the wallets table does not exist.
    const sessionEmail = sessionData.session?.user?.email ?? null;
    const [wRes, pRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', uid).maybeSingle(),
      // Use '*' so the app doesn't break if optional columns (first_name/last_name/full_name) haven't been added yet.
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    ]);

    if (wRes.error) {
      if (!isMissingTableError(wRes.error)) {
        setError(wRes.error.message);
        setProfile(null);
        setWallet(null);
        setLoading(false);
        return;
      }
      // Missing wallets table → continue to `users` flow below.
    } else {
      // We have a wallets table (even if row missing); fill profile from profiles (or session email).
      if (pRes.data) {
        const p = pRes.data as Record<string, unknown>;
        setProfile({
          id: String(p.id),
          email: (p.email as string) ?? sessionEmail,
          first_name: (p.first_name as string) ?? null,
          last_name: (p.last_name as string) ?? null,
          full_name: (p.full_name as string) ?? null,
          username: (p.username as string) ?? null,
          phone: null,
          country: null,
          is_verified: false,
        });
      } else {
        setProfile({
          id: uid,
          email: sessionEmail,
          first_name: null,
          last_name: null,
          full_name: null,
          username: null,
          phone: null,
          country: null,
          is_verified: false,
        });
      }

      if (wRes.data) {
        setWallet(mapWalletsRow(wRes.data as Record<string, unknown>, uid));
        setError(null);
        setLoading(false);
        return;
      }

      // Wallet row missing → auto-create and retry.
      try {
        await ensureLegacyProfileAndWallet(uid, sessionEmail);
        const wRetry = await supabase.from('wallets').select('*').eq('user_id', uid).maybeSingle();
        if (wRetry.data) {
          setWallet(mapWalletsRow(wRetry.data as Record<string, unknown>, uid));
          setError(null);
          setLoading(false);
          return;
        }
        if (wRetry.error) setError(wRetry.error.message);
      } catch (e) {
        setError((e as Error)?.message ?? 'Failed to create wallet row.');
      }

      setWallet(null);
      setLoading(false);
      return;
    }

    // `select('*')` avoids hard failure when optional columns (e.g. wallet_balance) are missing.
    const uRes = await supabase.from('users').select('*').eq('id', uid).maybeSingle();

    if (uRes.error) {
      // If `public.users` table does not exist (common when using the MVP schema with `profiles` + `wallets`),
      // fall back to legacy reads instead of hard-failing the whole app.
      if (!isMissingTableError(uRes.error)) {
        setError(uRes.error.message);
        setProfile(null);
        setWallet(null);
        setLoading(false);
        return;
      }
    }

    if (uRes.data) {
      const u = uRes.data as Record<string, unknown>;
      setError(null);
      setProfile({
        id: String(u.id),
        email: (u.email as string) ?? null,
        first_name: ((u as any).first_name as string) ?? null,
        last_name: ((u as any).last_name as string) ?? null,
        full_name: ((u as any).full_name as string) ?? null,
        username: (u.username as string) ?? null,
        phone: (u.phone as string) ?? null,
        country: (u.country as string) ?? null,
        is_verified: Boolean(u.is_verified),
      });
      setWallet(mapUsersRow(u, uid));
      setLoading(false);
      return;
    }

    // If `users` has no row, we do not auto-create here (apps using `users` should create it at signup).
    setWallet(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  return { profile, wallet, session, loading, error, refresh };
}
