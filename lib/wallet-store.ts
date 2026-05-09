import { useSyncExternalStore } from 'react';

import type { WalletRow } from '@/hooks/use-account-data';

type Listener = () => void;

/** Shop funding USD (`wallet_balance`) — buy scroll packs only. */
let shopWalletUsd = 0;
/** Withdrawable USD (`usd_balance` / “USD ready”) — conversion output & withdrawals. */
let usdReadyUsd = 0;
let coinBalance = 0;
let scrollPoints = 0;
let gasFeeBalance = 0;

const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

/** Sync in-memory snapshot from `WalletRow` after Supabase reads/writes. */
export function hydrateWalletFromServer(w: WalletRow) {
  shopWalletUsd = Number(w.wallet_balance);
  usdReadyUsd = Number(w.usd_ready);
  coinBalance = Number(w.coin_balance);
  scrollPoints = Number(w.scroll_points);
  gasFeeBalance = Number(w.gas_fee_balance);
  emit();
}

export function resetWalletStore() {
  shopWalletUsd = 0;
  usdReadyUsd = 0;
  coinBalance = 0;
  scrollPoints = 0;
  gasFeeBalance = 0;
  emit();
}

/** @deprecated Prefer useUsdReady — USD withdrawable balance (“USD ready”). */
export function getWalletUsd() {
  return usdReadyUsd;
}

/** @deprecated Prefer setUsdReady */
export function setWalletUsd(next: number) {
  usdReadyUsd = next;
  emit();
}

/** @deprecated Prefer adjustUsdReady */
export function adjustWalletUsd(delta: number) {
  usdReadyUsd = usdReadyUsd + delta;
  emit();
}

/** Withdrawable USD only (not shop wallet). Name kept for older screens (`withdrawal.tsx`). */
export function useWalletUsd() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => usdReadyUsd,
    () => usdReadyUsd
  );
}

/** Shop wallet USD — fund account / buy SP only. */
export function useShopWalletBalance() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => shopWalletUsd,
    () => shopWalletUsd
  );
}

export function useCoinBalance() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => coinBalance,
    () => coinBalance
  );
}

export function useScrollPoints() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => scrollPoints,
    () => scrollPoints
  );
}

export function useGasFeeBalance() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => gasFeeBalance,
    () => gasFeeBalance
  );
}
