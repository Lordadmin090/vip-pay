import { supabase } from '@/lib/supabase';

function isMissingTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const msg = (e?.message ?? '').toLowerCase();
  if (code === '42P01') return true;
  return msg.includes('does not exist') || msg.includes('undefined_table') || msg.includes('relation') || msg.includes('schema cache');
}

export type ActivityCategory =
  | 'earn_watch'
  | 'purchase_sp'
  | 'withdraw'
  | 'conversion'
  | 'gas_topup'
  | 'fund_wallet'
  | 'other';

export type WalletActivityRow = {
  id: string;
  user_id: string;
  category: ActivityCategory;
  title: string;
  subtitle: string | null;
  amount_coins: number | null;
  amount_usd: number | null;
  amount_sp: number | null;
  status: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

type PurchaseRow = {
  id: string;
  user_id: string;
  purchase_type: string;
  status: string;
  scroll_points: number;
  amount_usd: number;
  payment_method: string | null;
  proof_image_url: string | null;
  created_at: string;
};

type TxRow = {
  id: string;
  user_id: string;
  balance_type: string;
  direction: string;
  amount: number;
  sp_delta: number;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
};

type WithdrawalRow = {
  id: string;
  user_id: string;
  method: string;
  status: string;
  amount_usd: number;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  crypto_asset: string | null;
  network: string | null;
  wallet_address: string | null;
  created_at: string;
};

function mapPurchaseToActivity(p: PurchaseRow): WalletActivityRow {
  const type = (p.purchase_type || '').toLowerCase();
  const category: ActivityCategory =
    type === 'deposit_wallet'
      ? 'fund_wallet'
      : type === 'gas_fee_topup'
        ? 'gas_topup'
        : type === 'scroll_points'
          ? 'purchase_sp'
          : 'other';
  const title =
    category === 'fund_wallet'
      ? 'Wallet balance top up'
      : category === 'gas_topup'
        ? 'Gas fee top up'
        : category === 'purchase_sp'
          ? 'Scroll points purchase'
          : 'Purchase';
  const pm = (p.payment_method ?? '').toUpperCase();
  return {
    id: p.id,
    user_id: p.user_id,
    category,
    title,
    subtitle: [pm, p.proof_image_url ? 'receipt uploaded' : null].filter(Boolean).join(' • ') || null,
    amount_coins: null,
    amount_usd: Number(p.amount_usd ?? 0),
    amount_sp: Number(p.scroll_points ?? 0) || null,
    status: p.status || 'pending',
    meta: {
      payment_method: p.payment_method,
      exchange: p.payment_method,
      proof: p.proof_image_url,
      purchase_type: p.purchase_type,
    },
    created_at: p.created_at,
  };
}

function mapWithdrawalToActivity(w: WithdrawalRow): WalletActivityRow {
  const method = (w.method || '').toLowerCase();
  const payout =
    method === 'bank'
      ? [
          w.bank_name ?? 'Bank',
          w.account_number ? `•••• ${String(w.account_number).slice(-4)}` : null,
        ]
          .filter(Boolean)
          .join(' • ')
      : [
          w.crypto_asset ?? 'USDT',
          w.network ?? null,
          w.wallet_address ? `${w.wallet_address.slice(0, 6)}…${w.wallet_address.slice(-4)}` : null,
        ]
          .filter(Boolean)
          .join(' • ');

  return {
    id: String(w.id),
    user_id: String(w.user_id),
    category: 'withdraw',
    title: method === 'bank' ? 'Withdrawal (bank)' : 'Withdrawal (crypto)',
    subtitle: payout || null,
    // Show the withdrawal amount as a debit in History.
    amount_coins: null,
    amount_usd: -Math.abs(Number(w.amount_usd ?? 0)),
    amount_sp: null,
    status: (w.status || 'pending') as string,
    meta: {
      withdrawal_id: w.id,
      method: w.method,
      bank_name: w.bank_name,
      account_name: w.account_name,
      account_number: w.account_number,
      crypto_asset: w.crypto_asset,
      network: w.network,
      wallet_address: w.wallet_address,
      reference_type: 'withdrawal',
    },
    created_at: String(w.created_at),
  };
}

function mapTxToActivity(t: TxRow): WalletActivityRow {
  const ref = (t.reference_type || '').toLowerCase();
  const bal = (t.balance_type || '').toLowerCase();
  const dir = (t.direction || '').toLowerCase();
  const amt = Number(t.amount ?? 0);
  const spDelta = Number(t.sp_delta ?? 0);

  let category: ActivityCategory = 'other';
  let title = 'Activity';

  if (ref === 'watch_reward' || (bal === 'coin_balance' && dir === 'credit')) {
    category = 'earn_watch';
    title = 'Watch reward';
  } else if (ref === 'sp_purchase') {
    category = 'purchase_sp';
    title = 'Scroll points purchase';
  } else if (ref === 'withdraw' || ref.includes('withdraw')) {
    category = 'withdraw';
    title = 'Withdrawal';
  } else if (ref === 'conversion') {
    // Treat conversions as part of the "Withdrawals" history bucket (per product requirement).
    category = 'withdraw';
    title = 'Conversion';
  } else if (bal === 'gas_fee_balance') {
    category = 'gas_topup';
    title = dir === 'debit' ? 'Gas fee charge' : 'Gas fee top up';
  } else if (bal === 'scroll_points') {
    category = spDelta > 0 ? 'purchase_sp' : 'other';
    title = spDelta > 0 ? 'Scroll points credited' : 'Scroll points spent';
  }

  const signed = (v: number) => (dir === 'debit' ? -Math.abs(v) : Math.abs(v));
  const amountCoins = bal === 'coin_balance' ? signed(amt) : null;
  const amountUsd = bal === 'wallet_usd' ? signed(amt) : null;

  return {
    id: String(t.id),
    user_id: String(t.user_id),
    category,
    title,
    subtitle: t.note ?? null,
    amount_coins: amountCoins,
    amount_usd: amountUsd,
    amount_sp: spDelta !== 0 ? spDelta : null,
    status: 'completed',
    meta: {
      reference_type: t.reference_type,
      reference_id: t.reference_id,
      balance_type: t.balance_type,
      direction: t.direction,
    },
    created_at: String(t.created_at),
  };
}

export type NewWalletActivity = {
  category: ActivityCategory;
  title: string;
  subtitle?: string | null;
  amount_coins?: number | null;
  amount_usd?: number | null;
  amount_sp?: number | null;
  status?: string;
  meta?: Record<string, unknown> | null;
};

/** Best-effort audit log; failures do not block wallet updates. */
export async function logWalletActivity(userId: string, row: NewWalletActivity): Promise<void> {
  const { error } = await supabase.from('wallet_activities').insert({
    user_id: userId,
    category: row.category,
    title: row.title,
    subtitle: row.subtitle ?? null,
    amount_coins: row.amount_coins ?? null,
    amount_usd: row.amount_usd ?? null,
    amount_sp: row.amount_sp ?? null,
    status: row.status ?? 'completed',
    meta: row.meta ?? null,
  });
  if (error && __DEV__ && !isMissingTableError(error)) {
    // eslint-disable-next-line no-console
    console.warn('[wallet_activities]', error.message);
  }
}

export async function fetchWalletActivities(userId: string, limit = 100): Promise<WalletActivityRow[]> {
  const [wa, purchases, txs, withdrawals] = await Promise.all([
    supabase.from('wallet_activities').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
    supabase.from('purchases').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
    supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
    supabase
      .from('withdrawals')
      .select(
        'id,user_id,method,status,amount_usd,bank_name,account_name,account_number,crypto_asset,network,wallet_address,created_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const out: WalletActivityRow[] = [];

  if (wa.error) {
    if (__DEV__ && !isMissingTableError(wa.error)) {
      // eslint-disable-next-line no-console
      console.warn('[wallet_activities fetch]', wa.error.message);
    }
  } else {
    out.push(...(((wa.data as WalletActivityRow[]) ?? []) as WalletActivityRow[]));
  }

  if (purchases.error) {
    if (__DEV__ && !isMissingTableError(purchases.error)) {
      // eslint-disable-next-line no-console
      console.warn('[purchases fetch]', purchases.error.message);
    }
  } else {
    out.push(...(((purchases.data as PurchaseRow[]) ?? []).map(mapPurchaseToActivity)));
  }

  if (txs.error) {
    // If this fails (RLS missing), history will look empty. Always surface the warning in dev.
    if (__DEV__ && !isMissingTableError(txs.error)) {
      // eslint-disable-next-line no-console
      console.warn('[transactions fetch]', txs.error.message);
    }
  } else {
    out.push(...(((txs.data as TxRow[]) ?? []).map(mapTxToActivity)));
  }

  if (withdrawals.error) {
    if (__DEV__ && !isMissingTableError(withdrawals.error)) {
      // eslint-disable-next-line no-console
      console.warn('[withdrawals fetch]', withdrawals.error.message);
    }
  } else {
    out.push(...(((withdrawals.data as WithdrawalRow[]) ?? []).map(mapWithdrawalToActivity)));
  }

  // Deduplicate withdrawals across wallet_activities + transactions + withdrawals:
  // - withdrawals table is authoritative for status (pending/approved/rejected/paid)
  // - we key withdrawals by withdrawal_id/reference_id to avoid "double rows"
  const dedup = new Map<string, WalletActivityRow>();
  for (const r of out) {
    const meta = (r.meta ?? {}) as any;
    const isWithdraw = r.category === 'withdraw';
    const withdrawalId =
      (isWithdraw && (meta.withdrawal_id || meta.reference_id)) ? String(meta.withdrawal_id || meta.reference_id) : null;
    const key = withdrawalId ? `withdrawal:${withdrawalId}` : r.id;
    const prev = dedup.get(key);
    if (!prev) {
      dedup.set(key, r);
      continue;
    }
    // Prefer rows coming from `withdrawals` table because they carry the correct `status`.
    const prevHasStatus = typeof prev.status === 'string' && prev.status !== 'completed';
    const nextHasStatus = typeof r.status === 'string' && r.status !== 'completed';
    if (!prevHasStatus && nextHasStatus) {
      dedup.set(key, r);
      continue;
    }
    // Prefer richer withdrawal row (usually has payout subtitle).
    if ((prev.subtitle ?? '').length < (r.subtitle ?? '').length) {
      dedup.set(key, r);
    }
  }

  return [...dedup.values()]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
}

export async function fetchWalletActivityById(
  userId: string,
  activityId: string
): Promise<WalletActivityRow | null> {
  const [wa, purchase, tx, wd] = await Promise.all([
    supabase.from('wallet_activities').select('*').eq('user_id', userId).eq('id', activityId).maybeSingle(),
    supabase.from('purchases').select('*').eq('user_id', userId).eq('id', activityId).maybeSingle(),
    supabase.from('transactions').select('*').eq('user_id', userId).eq('id', activityId).maybeSingle(),
    supabase
      .from('withdrawals')
      .select(
        'id,user_id,method,status,amount_usd,bank_name,account_name,account_number,crypto_asset,network,wallet_address,created_at'
      )
      .eq('user_id', userId)
      .eq('id', activityId)
      .maybeSingle(),
  ]);

  if (!wa.error && wa.data) return wa.data as WalletActivityRow;
  if (!purchase.error && purchase.data) return mapPurchaseToActivity(purchase.data as PurchaseRow);
  if (!tx.error && tx.data) return mapTxToActivity(tx.data as TxRow);
  if (!wd.error && wd.data) return mapWithdrawalToActivity(wd.data as WithdrawalRow);
  return null;
}

export function isEarningCategory(c: ActivityCategory): boolean {
  // Earnings tab should ONLY show watch rewards (coins earned from videos).
  return c === 'earn_watch';
}

export function isPurchaseCategory(c: ActivityCategory): boolean {
  return c === 'purchase_sp' || c === 'fund_wallet' || c === 'gas_topup';
}

export function isWithdrawCategory(c: ActivityCategory): boolean {
  return c === 'withdraw';
}
