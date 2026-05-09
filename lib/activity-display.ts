import type { ActivityCategory, WalletActivityRow } from '@/lib/wallet-activities';
import { vibeColors } from '@/components/vibepay/vibe-screen';

export function categoryVisual(category: ActivityCategory): {
  icon: 'play' | 'cart-outline' | 'card' | 'flame' | 'cash' | 'swap-horizontal' | 'ellipse';
  iconBg: string;
  iconColor: string;
} {
  switch (category) {
    case 'earn_watch':
      return { icon: 'play', iconBg: 'rgba(254,44,85,0.10)', iconColor: vibeColors.primary };
    case 'purchase_sp':
      return { icon: 'cart-outline', iconBg: 'rgba(29,161,242,0.10)', iconColor: vibeColors.secondary };
    case 'fund_wallet':
      return { icon: 'card', iconBg: 'rgba(29,161,242,0.10)', iconColor: vibeColors.secondary };
    case 'gas_topup':
      return { icon: 'flame', iconBg: 'rgba(254,44,85,0.10)', iconColor: vibeColors.primary };
    case 'withdraw':
      return { icon: 'cash', iconBg: 'rgba(250,204,21,0.10)', iconColor: '#facc15' };
    case 'conversion':
      return { icon: 'swap-horizontal', iconBg: 'rgba(250,204,21,0.10)', iconColor: '#facc15' };
    default:
      return { icon: 'ellipse', iconBg: 'rgba(255,255,255,0.06)', iconColor: vibeColors.muted };
  }
}

export function formatActivityAmount(a: WalletActivityRow): string {
  const coins = a.amount_coins != null ? Number(a.amount_coins) : null;
  const usd = a.amount_usd != null ? Number(a.amount_usd) : null;
  const sp = a.amount_sp != null ? Number(a.amount_sp) : null;

  if (coins != null && coins !== 0 && Number.isFinite(coins)) {
    return `${coins > 0 ? '+' : ''}${coins.toLocaleString('en-US', { maximumFractionDigits: 2 })} COINS`;
  }
  if (usd != null && usd !== 0 && Number.isFinite(usd)) {
    const abs = Math.abs(usd);
    return `${usd < 0 ? '−' : '+'}$${abs.toFixed(2)}`;
  }
  if (sp != null && sp !== 0 && Number.isFinite(sp)) {
    return `${sp > 0 ? '+' : ''}${Math.round(Math.abs(sp)).toLocaleString('en-US')} SP`;
  }
  return '—';
}

export function formatActivityWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Short relative label for notification lists (e.g. "3m ago", "Yesterday"). */
export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const nowMs = Date.now();
  const diffMs = nowMs - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const today = new Date();
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  ) {
    return 'Yesterday';
  }
  return formatActivityWhenShort(iso);
}

export function formatActivityWhenShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const ySame =
    d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
  if (ySame) {
    return `Yesterday, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return formatActivityWhen(iso);
}

function sameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function sectionLabelForDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  if (sameCalendarDay(d, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameCalendarDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function groupActivitiesForSections(items: WalletActivityRow[]): { section: string; rows: WalletActivityRow[] }[] {
  const out: { section: string; rows: WalletActivityRow[] }[] = [];
  let cur = '';
  for (const it of items) {
    const sec = sectionLabelForDate(it.created_at);
    if (sec !== cur) {
      cur = sec;
      out.push({ section: sec, rows: [it] });
    } else {
      out[out.length - 1].rows.push(it);
    }
  }
  return out;
}
