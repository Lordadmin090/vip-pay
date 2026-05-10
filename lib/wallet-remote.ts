import type { WalletRow } from '@/lib/types/account';
import { logWalletActivity } from '@/lib/wallet-activities';
import { supabase } from '@/lib/supabase';

const BAL_COLS =
  'id,wallet_balance,usd_balance,coin_balance,sp_balance,gas_fee_balance' as const;

function isMissingTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const msg = (e?.message ?? '').toLowerCase();
  if (code === '42P01') return true; // undefined_table
  return msg.includes('does not exist') || msg.includes('undefined_table') || msg.includes('relation') || msg.includes('schema cache');
}

async function logTransactionBestEffort(row: {
  user_id: string;
  balance_type: 'wallet_usd' | 'coin_balance' | 'scroll_points' | 'gas_fee_balance';
  direction: 'credit' | 'debit';
  amount: number;
  sp_delta?: number;
  reference_type?: string | null;
  reference_id?: string | null;
  note?: string | null;
}) {
  const { error } = await supabase.from('transactions').insert({
    user_id: row.user_id,
    balance_type: row.balance_type,
    direction: row.direction,
    amount: row.amount,
    sp_delta: row.sp_delta ?? 0,
    reference_type: row.reference_type ?? null,
    reference_id: row.reference_id ?? null,
    note: row.note ?? null,
  });
  // Missing table is fine (some deployments don't use transactions). Do not block wallet updates.
  if (error && __DEV__ && !isMissingTableError(error)) {
    // eslint-disable-next-line no-console
    console.warn('[transactions]', error.message);
  }
}

async function logPurchaseBestEffort(row: {
  user_id: string;
  purchase_type: 'scroll_points' | 'deposit_wallet' | 'gas_fee_topup' | string;
  status: 'pending' | 'completed' | 'failed' | 'rejected' | string;
  scroll_points: number;
  amount_usd: number;
  payment_method: string | null;
  proof_image_url?: string | null;
}) {
  const { error } = await supabase.from('purchases').insert({
    user_id: row.user_id,
    purchase_type: row.purchase_type,
    status: row.status,
    scroll_points: row.scroll_points,
    amount_usd: row.amount_usd,
    payment_method: row.payment_method,
    proof_image_url: row.proof_image_url ?? null,
  });
  if (error && __DEV__ && !isMissingTableError(error)) {
    // eslint-disable-next-line no-console
    console.warn('[purchases]', error.message);
  }
}

// Use '*' for backwards/forwards compatibility as legacy deployments may add columns over time.
const WALLET_LEGACY_COLS = '*' as const;

function mapLegacyWalletsRow(row: any): WalletRow {
  return {
    user_id: String(row.user_id),
    wallet_balance: Number(row.wallet_balance ?? 0),
    // Legacy schema stores USD-ready in `wallet_usd`.
    usd_ready: Number(row.wallet_usd ?? row.usd_ready ?? 0),
    coin_balance: Number(row.coin_balance ?? 0),
    scroll_points: Number(row.scroll_points ?? row.sp_balance ?? 0),
    gas_fee_balance: Number(row.gas_fee_balance ?? row.gas_fee ?? 0),
  };
}

function mapWalletRow(row: {
  id: string;
  wallet_balance: number | string;
  usd_balance: number | string;
  coin_balance: number | string;
  sp_balance: number | string;
  gas_fee_balance: number | string;
}): WalletRow {
  return {
    user_id: row.id,
    wallet_balance: Number(row.wallet_balance ?? 0),
    usd_ready: Number(row.usd_balance ?? 0),
    coin_balance: Number(row.coin_balance ?? 0),
    scroll_points: Number(row.sp_balance ?? 0),
    gas_fee_balance: Number(row.gas_fee_balance ?? 0),
  };
}

function noRowsUpdatedMessage(): string {
  return (
    'Your database did not apply the update. Add an UPDATE policy on `public.users` where id = auth.uid() ' +
    '(see supabase/sql/users_rls.example.sql).'
  );
}

function noLegacyWalletRowsUpdatedMessage(): string {
  return (
    'Your database did not apply the update to `public.wallets`. Add INSERT/UPDATE policies on `public.wallets` ' +
    '(see supabase/sql/wallets_rls.example.sql), or handle wallet mutations via an Edge Function.'
  );
}

/** Add coins after a completed watch reward. */
export async function addWatchCoins(userId: string, amount: number): Promise<{ wallet: WalletRow | null; error: string | null }> {
  const { data: authData } = await supabase.auth.getSession();
  const uid = authData.session?.user?.id;
  if (!uid || uid !== userId) {
    return { wallet: null, error: 'Session expired or mismatched. Please sign in again.' };
  }

  // Prefer MVP schema: `public.wallets` (matches your SQL). Only fall back to `public.users` if wallets table is missing.
  const { data: wRow, error: wReadErr } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  if (wReadErr) {
    if (!isMissingTableError(wReadErr)) return { wallet: null, error: wReadErr.message };
    // Missing wallets table → continue to users flow below.
  } else {
    if (!wRow) return { wallet: null, error: 'Wallet not found for this account.' };

    const nextCoins = Number((wRow as any).coin_balance ?? 0) + amount;
    const { data: updatedRows, error: writeErr } = await supabase
      .from('wallets')
      .update({ coin_balance: nextCoins })
      .eq('user_id', userId)
      .select(WALLET_LEGACY_COLS);
    if (writeErr) return { wallet: null, error: writeErr.message };
    const updated = updatedRows?.[0] as any;
    if (!updated) return { wallet: null, error: noLegacyWalletRowsUpdatedMessage() };

    void logWalletActivity(userId, {
      category: 'earn_watch',
      title: 'Watch reward',
      subtitle: 'Video completed',
      amount_coins: amount,
      status: 'completed',
      meta: { coins_added: amount, schema: 'wallets' },
    });
    void logTransactionBestEffort({
      user_id: userId,
      balance_type: 'coin_balance',
      direction: 'credit',
      amount,
      sp_delta: 0,
      reference_type: 'watch_reward',
      note: 'Video completed',
    });

    return { wallet: mapLegacyWalletsRow(updated), error: null };
  }

  let { data: row, error: readErr } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (readErr) {
    if (isMissingTableError(readErr)) {
      // Legacy schema: public.wallets
      const { data: wRow, error: wReadErr } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
      if (wReadErr) return { wallet: null, error: wReadErr.message };
      if (!wRow) {
        // Try create the row if policy/trigger allows.
        const { data: inserted, error: insErr } = await supabase
          .from('wallets')
          // Don't set `scroll_points` here — let DB default apply to avoid wiping/incorrect defaults.
          .insert({ user_id: userId, wallet_usd: 0, coin_balance: amount, gas_fee_balance: 0 })
          .select(WALLET_LEGACY_COLS);
        if (insErr) return { wallet: null, error: insErr.message };
        const first = inserted?.[0] as any;
        if (!first) return { wallet: null, error: noLegacyWalletRowsUpdatedMessage() };
        void logWalletActivity(userId, {
          category: 'earn_watch',
          title: 'Watch reward',
          subtitle: 'Video completed',
          amount_coins: amount,
          status: 'completed',
          meta: { coins_added: amount, schema: 'wallets' },
        });
        void logTransactionBestEffort({
          user_id: userId,
          balance_type: 'coin_balance',
          direction: 'credit',
          amount,
          sp_delta: 0,
          reference_type: 'watch_reward',
          note: 'Video completed',
        });
        return { wallet: mapLegacyWalletsRow(first), error: null };
      }

      const nextCoins = Number((wRow as any).coin_balance) + amount;
      const { data: updatedRows, error: writeErr } = await supabase
        .from('wallets')
        .update({ coin_balance: nextCoins })
        .eq('user_id', userId)
        .select(WALLET_LEGACY_COLS);
      if (writeErr) return { wallet: null, error: writeErr.message };
      const updated = updatedRows?.[0] as any;
      if (!updated) return { wallet: null, error: noLegacyWalletRowsUpdatedMessage() };
      void logWalletActivity(userId, {
        category: 'earn_watch',
        title: 'Watch reward',
        subtitle: 'Video completed',
        amount_coins: amount,
        status: 'completed',
        meta: { coins_added: amount, schema: 'wallets' },
      });
      void logTransactionBestEffort({
        user_id: userId,
        balance_type: 'coin_balance',
        direction: 'credit',
        amount,
        sp_delta: 0,
        reference_type: 'watch_reward',
        note: 'Video completed',
      });
      return { wallet: mapLegacyWalletsRow(updated), error: null };
    }
    return { wallet: null, error: readErr.message };
  }

  if (!row) {
    const { data: userRes } = await supabase.auth.getUser();
    const em = userRes.user?.email;
    if (!em) return { wallet: null, error: 'No email on session. Cannot create user row.' };

    const { data: inserted, error: insErr } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: em,
        coin_balance: amount,
        wallet_balance: 0,
        usd_balance: 0,
        sp_balance: 0,
        gas_fee_balance: 0,
      })
      .select(BAL_COLS);
    if (insErr) return { wallet: null, error: insErr.message };
    const first = inserted?.[0];
    if (!first) return { wallet: null, error: noRowsUpdatedMessage() };
    void logWalletActivity(userId, {
      category: 'earn_watch',
      title: 'Watch reward',
      subtitle: 'Video completed',
      amount_coins: amount,
      status: 'completed',
      meta: { coins_added: amount },
    });
    return { wallet: mapWalletRow(first), error: null };
  }

  const nextCoins = Number(row.coin_balance) + amount;
  const { data: updatedRows, error: writeErr } = await supabase
    .from('users')
    .update({ coin_balance: nextCoins })
    .eq('id', userId)
    .select(BAL_COLS);
  if (writeErr) return { wallet: null, error: writeErr.message };
  const updated = updatedRows?.[0];
  if (!updated) return { wallet: null, error: noRowsUpdatedMessage() };
  void logWalletActivity(userId, {
    category: 'earn_watch',
    title: 'Watch reward',
    subtitle: 'Video completed',
    amount_coins: amount,
    status: 'completed',
    meta: { coins_added: amount },
  });
  return { wallet: mapWalletRow(updated), error: null };
}

export async function saveScrollPoints(userId: string, nextPoints: number): Promise<{ wallet: WalletRow | null; error: string | null }> {
  const { data: authData } = await supabase.auth.getSession();
  const uid = authData.session?.user?.id;
  if (!uid || uid !== userId) {
    return { wallet: null, error: 'Session expired. Please sign in again.' };
  }

  const clamped = Math.max(0, Math.round(Number(nextPoints)));

  // Prefer MVP schema: `public.wallets` (matches your SQL).
  const { data: wRow, error: wReadErr } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  if (wReadErr) {
    if (!isMissingTableError(wReadErr)) return { wallet: null, error: wReadErr.message };
    // Missing wallets table → continue to users flow below.
  } else {
    if (!wRow) return { wallet: null, error: 'Wallet not found for this account.' };
    const prev = Math.max(0, Math.round(Number((wRow as any).scroll_points ?? 0)));
    const delta = clamped - prev;

    const { data: updatedRows, error: writeErr } = await supabase
      .from('wallets')
      .update({ scroll_points: clamped })
      .eq('user_id', userId)
      .select(WALLET_LEGACY_COLS);
    if (writeErr) return { wallet: null, error: writeErr.message };
    const updated = updatedRows?.[0] as any;
    if (!updated) return { wallet: null, error: noLegacyWalletRowsUpdatedMessage() };

    if (delta !== 0) {
      void logTransactionBestEffort({
        user_id: userId,
        balance_type: 'scroll_points',
        direction: delta > 0 ? 'credit' : 'debit',
        amount: 0,
        sp_delta: delta,
        reference_type: 'watch_spend',
        note: 'Scroll points adjustment',
      });
    }
    return { wallet: mapLegacyWalletsRow(updated), error: null };
  }

  const { data: rows, error } = await supabase
    .from('users')
    .update({ sp_balance: clamped })
    .eq('id', userId)
    .select(BAL_COLS);
  if (error) {
    if (isMissingTableError(error)) {
      // Legacy schema: read current so we can compute sp_delta for transactions.
      const { data: wRow, error: wReadErr } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
      if (wReadErr) return { wallet: null, error: wReadErr.message };
      if (!wRow) return { wallet: null, error: 'Wallet not found for this account.' };

      const prev = Math.max(0, Math.round(Number((wRow as any).scroll_points ?? 0)));
      const delta = clamped - prev;

      const { data: updatedRows, error: writeErr } = await supabase
        .from('wallets')
        .update({ scroll_points: clamped })
        .eq('user_id', userId)
        .select(WALLET_LEGACY_COLS);
      if (writeErr) return { wallet: null, error: writeErr.message };
      const updated = updatedRows?.[0] as any;
      if (!updated) return { wallet: null, error: noLegacyWalletRowsUpdatedMessage() };

      if (delta !== 0) {
        void logTransactionBestEffort({
          user_id: userId,
          balance_type: 'scroll_points',
          direction: delta > 0 ? 'credit' : 'debit',
          amount: 0,
          sp_delta: delta,
          reference_type: 'watch_spend',
          note: 'Scroll points adjustment',
        });
      }

      return { wallet: mapLegacyWalletsRow(updated), error: null };
    }
    return { wallet: null, error: error.message };
  }
  const updated = rows?.[0];
  if (!updated) return { wallet: null, error: noRowsUpdatedMessage() };
  return { wallet: mapWalletRow(updated), error: null };
}

/** Debit **shop wallet** (`wallet_balance`) only — never `usd_balance`. */
export async function purchaseScrollPack(
  userId: string,
  priceUsd: number,
  totalScrollPoints: number
): Promise<{ wallet: WalletRow | null; error: string | null }> {
  // Prefer MVP schema: `public.wallets` (matches your SQL). Only fall back to `public.users` if wallets table is missing.
  const { data: wRow, error: wReadErr } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  if (wReadErr) {
    if (!isMissingTableError(wReadErr)) return { wallet: null, error: wReadErr.message };
    // Missing wallets table → continue to users flow below.
  } else {
    if (!wRow) return { wallet: null, error: 'Wallet not found for this account.' };

    const walletUsd = Number((wRow as any).wallet_balance ?? 0);
    const sp = Number((wRow as any).scroll_points ?? 0);
    if (!Number.isFinite(walletUsd) || walletUsd + 1e-9 < priceUsd) {
      return { wallet: null, error: 'Insufficient wallet balance. Fund your wallet to buy scroll points.' };
    }

    const nextWalletUsd = walletUsd - priceUsd;
    const nextSp = sp + Math.max(0, Math.round(totalScrollPoints));
    const { data: updatedRows, error: writeErr } = await supabase
      .from('wallets')
      .update({ wallet_balance: nextWalletUsd, scroll_points: nextSp })
      .eq('user_id', userId)
      .select(WALLET_LEGACY_COLS);
    if (writeErr) return { wallet: null, error: writeErr.message };
    const updated = updatedRows?.[0] as any;
    if (!updated) return { wallet: null, error: noLegacyWalletRowsUpdatedMessage() };
    // Make sure History/Wallet recent activity can show this even if `purchases` table is missing.
    void logTransactionBestEffort({
      user_id: userId,
      balance_type: 'scroll_points',
      direction: 'credit',
      amount: 0,
      sp_delta: Math.max(0, Math.round(totalScrollPoints)),
      reference_type: 'sp_purchase',
      note: `Bought ${Math.max(0, Math.round(totalScrollPoints))} SP for $${Number(priceUsd).toFixed(2)}`,
    });
    void logPurchaseBestEffort({
      user_id: userId,
      purchase_type: 'scroll_points',
      status: 'completed',
      scroll_points: Math.max(0, Math.round(totalScrollPoints)),
      amount_usd: Number(priceUsd),
      payment_method: 'wallet',
      proof_image_url: null,
    });
    void logWalletActivity(userId, {
      category: 'purchase_sp',
      title: 'Scroll points purchase',
      subtitle: `$${priceUsd.toFixed(2)} from wallet • +${Math.round(totalScrollPoints)} SP`,
      amount_usd: -priceUsd,
      amount_sp: Math.round(totalScrollPoints),
      status: 'completed',
      meta: { price_usd: priceUsd, scroll_points_added: totalScrollPoints, schema: 'wallets' },
    });
    return { wallet: mapLegacyWalletsRow(updated), error: null };
  }

  // Fallback: legacy `public.users` schema
  const { data: row, error: readErr } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (readErr) return { wallet: null, error: readErr.message };
  if (!row) return { wallet: null, error: 'Account not found' };

  const shop = Number(row.wallet_balance ?? 0);
  const sp = Number(row.sp_balance ?? 0);
  if (!Number.isFinite(shop) || shop + 1e-9 < priceUsd) {
    return { wallet: null, error: 'Insufficient wallet balance. Fund your wallet to buy scroll points.' };
  }

  const nextShop = shop - priceUsd;
  const nextSp = sp + Math.max(0, Math.round(totalScrollPoints));

  const { data: updatedRows, error: writeErr } = await supabase
    .from('users')
    .update({
      wallet_balance: nextShop,
      sp_balance: nextSp,
    })
    .eq('id', userId)
    .select(BAL_COLS);

  if (writeErr) return { wallet: null, error: writeErr.message };
  const updated = updatedRows?.[0];
  if (!updated) return { wallet: null, error: noRowsUpdatedMessage() };
  void logTransactionBestEffort({
    user_id: userId,
    balance_type: 'scroll_points',
    direction: 'credit',
    amount: 0,
    sp_delta: Math.max(0, Math.round(totalScrollPoints)),
    reference_type: 'sp_purchase',
    note: `Bought ${Math.max(0, Math.round(totalScrollPoints))} SP for $${Number(priceUsd).toFixed(2)}`,
  });
  void logPurchaseBestEffort({
    user_id: userId,
    purchase_type: 'scroll_points',
    status: 'completed',
    scroll_points: Math.max(0, Math.round(totalScrollPoints)),
    amount_usd: Number(priceUsd),
    payment_method: 'wallet',
    proof_image_url: null,
  });
  void logWalletActivity(userId, {
    category: 'purchase_sp',
    title: 'Scroll points purchase',
    subtitle: `$${priceUsd.toFixed(2)} from wallet • +${Math.round(totalScrollPoints)} SP`,
    amount_usd: -priceUsd,
    amount_sp: Math.round(totalScrollPoints),
    status: 'completed',
    meta: { price_usd: priceUsd, scroll_points_added: totalScrollPoints, from: 'wallet_balance' },
  });
  return { wallet: mapWalletRow(updated), error: null };
}

/** Convert coins → **USD ready** (`usd_balance`) only. */
export async function convertCoinsToUsd(
  userId: string,
  coinsToConvert: number,
  coinsPerUsd: number,
  minConvert: number,
  maxConvert: number
): Promise<{ wallet: WalletRow | null; error: string | null }> {
  const { data: authData } = await supabase.auth.getSession();
  const uid = authData.session?.user?.id;
  if (!uid || uid !== userId) {
    return { wallet: null, error: 'Session expired. Please sign in again.' };
  }

  const c = Math.round(Number(coinsToConvert));
  if (!Number.isFinite(c) || c <= 0) {
    return { wallet: null, error: 'Enter a valid coin amount.' };
  }
  if (c < minConvert) {
    return { wallet: null, error: `Minimum conversion is ${Math.round(minConvert)} coins.` };
  }
  if (c > maxConvert) {
    return { wallet: null, error: `Maximum conversion is ${Math.round(maxConvert)} coins.` };
  }

  const rate = Number(coinsPerUsd);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { wallet: null, error: 'Invalid conversion rate.' };
  }

  const usdAdded = c / rate;

  // Prefer MVP schema: `public.wallets` (matches your SQL). Only fall back to `public.users` if wallets table is missing.
  const { data: wRow, error: wReadErr } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  if (wReadErr) {
    if (!isMissingTableError(wReadErr)) return { wallet: null, error: wReadErr.message };
    // Missing wallets table → continue to users flow below.
  } else {
    if (!wRow) return { wallet: null, error: 'Wallet not found for this account.' };

    const bal = Number((wRow as any).coin_balance ?? 0);
    const usdReady = Number((wRow as any).wallet_usd ?? 0);
    if (bal + 1e-9 < c) return { wallet: null, error: 'Insufficient coin balance.' };

    const nextCoins = bal - c;
    const nextUsdReady = usdReady + usdAdded;
    const { data: updatedRows, error: writeErr } = await supabase
      .from('wallets')
      .update({ coin_balance: nextCoins, wallet_usd: nextUsdReady })
      .eq('user_id', userId)
      .select(WALLET_LEGACY_COLS);
    if (writeErr) return { wallet: null, error: writeErr.message };
    const updated = updatedRows?.[0] as any;
    if (!updated) return { wallet: null, error: noLegacyWalletRowsUpdatedMessage() };

    void logWalletActivity(userId, {
      category: 'conversion',
      title: 'Coins → USD ready',
      subtitle: `${c} coins → $${usdAdded.toFixed(2)}`,
      amount_coins: -c,
      amount_usd: usdAdded,
      status: 'completed',
      meta: { coins_converted: c, coins_per_usd: rate, schema: 'wallets' },
    });
    void logTransactionBestEffort({
      user_id: userId,
      balance_type: 'coin_balance',
      direction: 'debit',
      amount: c,
      sp_delta: 0,
      reference_type: 'conversion',
      note: `${c} coins → $${usdAdded.toFixed(2)}`,
    });
    void logTransactionBestEffort({
      user_id: userId,
      balance_type: 'wallet_usd',
      direction: 'credit',
      amount: usdAdded,
      sp_delta: 0,
      reference_type: 'conversion',
      note: `${c} coins → $${usdAdded.toFixed(2)}`,
    });

    return { wallet: mapLegacyWalletsRow(updated), error: null };
  }

  const { data: row, error: readErr } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (readErr) {
    if (isMissingTableError(readErr)) {
      const { data: wRow, error: wReadErr } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
      if (wReadErr) return { wallet: null, error: wReadErr.message };
      if (!wRow) return { wallet: null, error: 'Wallet not found for this account.' };

      const bal = Number((wRow as any).coin_balance ?? 0);
      const usdReady = Number((wRow as any).wallet_usd ?? 0);
      if (bal + 1e-9 < c) return { wallet: null, error: 'Insufficient coin balance.' };

      const nextCoins = bal - c;
      const nextUsdReady = usdReady + usdAdded;
      const { data: updatedRows, error: writeErr } = await supabase
        .from('wallets')
        .update({ coin_balance: nextCoins, wallet_usd: nextUsdReady })
        .eq('user_id', userId)
        .select(WALLET_LEGACY_COLS);
      if (writeErr) return { wallet: null, error: writeErr.message };
      const updated = updatedRows?.[0] as any;
      if (!updated) return { wallet: null, error: noLegacyWalletRowsUpdatedMessage() };
      void logWalletActivity(userId, {
        category: 'conversion',
        title: 'Coins → USD ready',
        subtitle: `${c} coins → $${usdAdded.toFixed(2)}`,
        amount_coins: -c,
        amount_usd: usdAdded,
        status: 'completed',
        meta: { coins_converted: c, coins_per_usd: rate, schema: 'wallets' },
      });
      return { wallet: mapLegacyWalletsRow(updated), error: null };
    }
    return { wallet: null, error: readErr.message };
  }
  if (!row) return { wallet: null, error: 'Account not found' };

  const bal = Number(row.coin_balance);
  if (bal + 1e-9 < c) {
    return { wallet: null, error: 'Insufficient coin balance.' };
  }

  const nextCoins = bal - c;
  const nextUsdReady = Number(row.usd_balance ?? 0) + usdAdded;

  const { data: updatedRows, error: writeErr } = await supabase
    .from('users')
    .update({
      coin_balance: nextCoins,
      usd_balance: nextUsdReady,
    })
    .eq('id', userId)
    .select(BAL_COLS);

  if (writeErr) return { wallet: null, error: writeErr.message };
  const updated = updatedRows?.[0];
  if (!updated) return { wallet: null, error: noRowsUpdatedMessage() };

  void logWalletActivity(userId, {
    category: 'conversion',
    title: 'Coins → USD ready',
    subtitle: `${c} coins → $${usdAdded.toFixed(2)}`,
    amount_coins: -c,
    amount_usd: usdAdded,
    status: 'completed',
    meta: { coins_converted: c, coins_per_usd: rate },
  });

  return { wallet: mapWalletRow(updated), error: null };
}

/** Debit **USD ready** + gas fee balance for withdrawal. */
export async function executeWithdrawalUsd(
  userId: string,
  withdrawalUsd: number,
  gasFeeUsd: number,
  details: {
    method: 'bank' | 'crypto';
    bank_name?: string | null;
    account_name?: string | null;
    account_number?: string | null;
    crypto_asset?: string | null;
    network?: string | null;
    wallet_address?: string | null;
  }
): Promise<{ wallet: WalletRow | null; error: string | null }> {
  const { data: authData } = await supabase.auth.getSession();
  const uid = authData.session?.user?.id;
  if (!uid || uid !== userId) {
    return { wallet: null, error: 'Session expired. Please sign in again.' };
  }

  const wu = Number(withdrawalUsd);
  const gf = Number(gasFeeUsd);
  if (!Number.isFinite(wu) || wu <= 0) {
    return { wallet: null, error: 'Invalid withdrawal amount.' };
  }
  if (!Number.isFinite(gf) || gf < 0) {
    return { wallet: null, error: 'Invalid gas fee.' };
  }

  // Prefer MVP schema: `public.wallets` (balances live here). Only fall back to `public.users` if wallets is missing.
  const { data: wRow, error: wReadErr } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  if (wReadErr) {
    if (!isMissingTableError(wReadErr)) return { wallet: null, error: wReadErr.message };
    // Missing wallets table → continue to users flow below.
  } else {
    if (!wRow) return { wallet: null, error: 'Wallet not found for this account.' };

    const usdReady = Number((wRow as any).wallet_usd ?? 0);
    const gasBal = Number((wRow as any).gas_fee_balance ?? (wRow as any).gas_fee ?? 0);
    if (gasBal + 1e-9 < gf) return { wallet: null, error: 'Insufficient gas fee' };
    if (usdReady + 1e-9 < wu) return { wallet: null, error: 'Insufficient USD ready balance' };

    // Create a pending withdrawal request for admin BEFORE debiting balances.
    const { data: wdIns, error: wdErr } = await supabase
      .from('withdrawals')
      .insert({
        user_id: userId,
        method: details.method,
        status: 'pending',
        amount_usd: wu,
        bank_name: details.bank_name ?? null,
        account_name: details.account_name ?? null,
        account_number: details.account_number ?? null,
        crypto_asset: details.crypto_asset ?? null,
        network: details.network ?? null,
        wallet_address: details.wallet_address ?? null,
      })
      .select('id')
      .maybeSingle();
    if (wdErr) return { wallet: null, error: wdErr.message };
    const withdrawalId = (wdIns as any)?.id as string | undefined;
    if (!withdrawalId) return { wallet: null, error: 'Failed to create withdrawal request.' };

    const nextUsd = usdReady - wu;
    const nextGas = gasBal - gf;
    const { data: updatedRows, error: writeErr } = await supabase
      .from('wallets')
      .update({ wallet_usd: nextUsd, gas_fee_balance: nextGas })
      .eq('user_id', userId)
      .select(WALLET_LEGACY_COLS);
    if (writeErr) {
      // Compensate: remove the pending request since balances were not debited.
      await supabase.from('withdrawals').delete().eq('id', withdrawalId).eq('user_id', userId);
      return { wallet: null, error: writeErr.message };
    }
    const updated = updatedRows?.[0] as any;
    if (!updated) return { wallet: null, error: noLegacyWalletRowsUpdatedMessage() };

    void logWalletActivity(userId, {
      category: 'withdraw',
      title: 'Withdrawal requested',
      subtitle: `$${wu.toFixed(2)} • gas $${gf.toFixed(2)}`,
      amount_usd: -wu,
      status: 'pending',
      meta: { withdrawal_id: withdrawalId, withdrawal_usd: wu, gas_fee_usd: gf, schema: 'wallets', method: details.method },
    });
    void logTransactionBestEffort({
      user_id: userId,
      balance_type: 'wallet_usd',
      direction: 'debit',
      amount: wu,
      sp_delta: 0,
      reference_type: 'withdrawal',
      reference_id: withdrawalId,
      note: 'Withdrawal requested',
    });
    if (gf > 0) {
      void logTransactionBestEffort({
        user_id: userId,
        balance_type: 'gas_fee_balance',
        direction: 'debit',
        amount: gf,
        sp_delta: 0,
        reference_type: 'withdrawal',
        reference_id: withdrawalId,
        note: 'Gas fee charged',
      });
    }

    return { wallet: mapLegacyWalletsRow(updated), error: null };
  }

  const { data: row, error: readErr } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (readErr) return { wallet: null, error: readErr.message };
  if (!row) return { wallet: null, error: 'Account not found' };

  const usdReady = Number(row.usd_balance ?? 0);
  const gasBal = Number((row as any).gas_fee_balance ?? (row as any).gas_fee ?? 0);

  if (gasBal + 1e-9 < gf) {
    return { wallet: null, error: 'Insufficient gas fee' };
  }
  if (usdReady + 1e-9 < wu) {
    return { wallet: null, error: 'Insufficient USD ready balance' };
  }

  const nextUsd = usdReady - wu;
  const nextGas = gasBal - gf;

  // Create a pending withdrawal request for admin BEFORE debiting balances.
  const { data: wdIns, error: wdErr } = await supabase
    .from('withdrawals')
    .insert({
      user_id: userId,
      method: details.method,
      status: 'pending',
      amount_usd: wu,
      bank_name: details.bank_name ?? null,
      account_name: details.account_name ?? null,
      account_number: details.account_number ?? null,
      crypto_asset: details.crypto_asset ?? null,
      network: details.network ?? null,
      wallet_address: details.wallet_address ?? null,
    })
    .select('id')
    .maybeSingle();
  if (wdErr) return { wallet: null, error: wdErr.message };
  const withdrawalId = (wdIns as any)?.id as string | undefined;
  if (!withdrawalId) return { wallet: null, error: 'Failed to create withdrawal request.' };

  const { data: updatedRows, error: writeErr } = await supabase
    .from('users')
    .update({
      usd_balance: nextUsd,
      gas_fee_balance: nextGas,
    })
    .eq('id', userId)
    .select(BAL_COLS);

  if (writeErr) {
    await supabase.from('withdrawals').delete().eq('id', withdrawalId).eq('user_id', userId);
    return { wallet: null, error: writeErr.message };
  }
  const updated = updatedRows?.[0];
  if (!updated) return { wallet: null, error: noRowsUpdatedMessage() };

  void logWalletActivity(userId, {
    category: 'withdraw',
    title: 'Withdrawal requested',
    subtitle: `$${wu.toFixed(2)} • gas $${gf.toFixed(2)}`,
    amount_usd: -wu,
    status: 'pending',
    meta: { withdrawal_id: withdrawalId, withdrawal_usd: wu, gas_fee_usd: gf, method: details.method },
  });
  void logTransactionBestEffort({
    user_id: userId,
    balance_type: 'wallet_usd',
    direction: 'debit',
    amount: wu,
    sp_delta: 0,
    reference_type: 'withdrawal',
    reference_id: withdrawalId,
    note: 'Withdrawal requested',
  });
  if (gf > 0) {
    void logTransactionBestEffort({
      user_id: userId,
      balance_type: 'gas_fee_balance',
      direction: 'debit',
      amount: gf,
      sp_delta: 0,
      reference_type: 'withdrawal',
      reference_id: withdrawalId,
      note: 'Gas fee charged',
    });
  }

  return { wallet: mapWalletRow(updated), error: null };
}
