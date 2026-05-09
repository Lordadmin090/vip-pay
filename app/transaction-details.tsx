import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import {
  categoryVisual,
  formatActivityAmount,
  formatActivityWhen,
} from '@/lib/activity-display';
import {
  type ActivityCategory,
  fetchWalletActivityById,
  type WalletActivityRow,
} from '@/lib/wallet-activities';
import { useAccountData } from '@/hooks/use-account-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { supabase } from '@/lib/supabase';
import { DEFAULT_APP_SETTINGS, type AppPlatformSettings, fetchAppSettings } from '@/lib/app-settings';

function categoryHeading(c: ActivityCategory): string {
  switch (c) {
    case 'earn_watch':
      return 'Watch reward';
    case 'purchase_sp':
      return 'Scroll points purchase';
    case 'fund_wallet':
      return 'Wallet funding';
    case 'gas_topup':
      return 'Gas fee top-up';
    case 'withdraw':
      return 'Withdrawal';
    case 'conversion':
      return 'Conversion';
    case 'other':
    default:
      return 'Activity';
  }
}

function statusTone(status: string): { icon: React.ComponentProps<typeof Ionicons>['name']; ok: boolean; warn: boolean } {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'success' || s === 'approved') {
    return { icon: 'checkmark-done', ok: true, warn: false };
  }
  if (s === 'pending' || s === 'processing') {
    return { icon: 'time', ok: false, warn: true };
  }
  if (s === 'failed' || s === 'rejected' || s === 'cancelled') {
    return { icon: 'close-circle', ok: false, warn: false };
  }
  return { icon: 'receipt', ok: true, warn: false };
}

function metaLines(meta: Record<string, unknown> | null): { label: string; value: string }[] {
  if (!meta || typeof meta !== 'object') return [];
  const out: { label: string; value: string }[] = [];
  const pick = (k: string, label: string) => {
    const v = meta[k];
    if (v === undefined || v === null) return;
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (s.length > 120) return;
    out.push({ label, value: s });
  };
  pick('video_id', 'Video');
  pick('pack_id', 'Pack');
  pick('reference', 'Reference');
  pick('network', 'Network');
  return out.slice(0, 6);
}

export default function TransactionDetailsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const bottomPad = Math.max(insets.bottom, 16);
  const params = useLocalSearchParams<{ id?: string | string[]; kind?: string }>();
  const activityId = useMemo(() => {
    const raw = params.id;
    if (Array.isArray(raw)) return raw[0];
    return raw;
  }, [params.id]);
  const kind = useMemo(() => String(params.kind ?? 'activity'), [params.kind]);

  const { session, refresh: refreshAccount } = useAccountData();
  const uid = session?.user?.id;

  const [row, setRow] = useState<WalletActivityRow | null>(null);
  const [initialBusy, setInitialBusy] = useState(true);
  const [appSettings, setAppSettings] = useState<AppPlatformSettings>(DEFAULT_APP_SETTINGS);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const load = useCallback(async () => {
    if (!uid || !activityId) {
      setRow(null);
      setInitialBusy(false);
      return;
    }
    setInitialBusy(true);
    try {
      if (kind === 'purchase') {
        const s = await fetchAppSettings();
        setAppSettings(s);
      }
      if (kind === 'purchase') {
        const { data, error } = await supabase
          .from('purchases')
          .select('id,user_id,purchase_type,status,amount_usd,payment_method,proof_image_url,created_at')
          .eq('user_id', uid)
          .eq('id', activityId)
          .maybeSingle();
        if (error || !data) {
          setRow(null);
        } else {
          const method = String((data as any).payment_method ?? '').toUpperCase() || 'PAYMENT';
          const title =
            (data as any).purchase_type === 'deposit_wallet'
              ? 'Wallet balance top up'
              : (data as any).purchase_type === 'gas_fee_topup'
                ? 'Gas fee top up'
                : 'Purchase';
          const amountUsd = Number((data as any).amount_usd ?? 0);
          setRow({
            id: String((data as any).id),
            user_id: String((data as any).user_id),
            category: 'fund_wallet',
            title,
            subtitle: `${method} • receipt uploaded`,
            amount_coins: null,
            amount_usd: amountUsd,
            amount_sp: null,
            status: String((data as any).status ?? 'pending'),
            meta: {
              payment_method: (data as any).payment_method,
              exchange: (data as any).payment_method,
              proof: (data as any).proof_image_url,
            } as any,
            created_at: String((data as any).created_at),
          });
        }
      } else {
        const r = await fetchWalletActivityById(uid, activityId);
        setRow(r);
      }
    } finally {
      setInitialBusy(false);
    }
  }, [uid, activityId, kind]);

  const refreshAll = useCallback(async () => {
    await refreshAccount();
    await load();
  }, [refreshAccount, load]);

  const { refreshing, onRefresh } = usePullToRefresh(refreshAll);

  useEffect(() => {
    load();
  }, [load]);

  const vis = row ? categoryVisual(row.category as ActivityCategory) : null;
  const tone = row ? statusTone(row.status) : null;
  const metaRows = row ? metaLines(row.meta) : [];

  const paymentMethodLabel = useMemo(() => {
    if (!row) return '—';
    const pm = String((row.meta as any)?.payment_method ?? '').toLowerCase();
    if (pm === 'ngn') return 'Bank Transfer (NGN)';
    if (pm === 'ghs') return 'Mobile Money (GHS)';
    if (pm === 'usdt') return 'USDT';
    // fallback from subtitle if present
    return row.subtitle?.split('•')?.[0]?.trim() || '—';
  }, [row]);

  const exchangeRateLabel = useMemo(() => {
    if (kind !== 'purchase') return '—';
    if (!row) return '—';
    const pm = String((row.meta as any)?.exchange ?? (row.meta as any)?.payment_method ?? '').toLowerCase();
    if (pm === 'ngn') return `₦${Number(appSettings.ngn_per_usd).toLocaleString()} / $1`;
    if (pm === 'ghs') return `GHS ${Number(appSettings.ghs_per_usd).toLocaleString()} / $1`;
    if (pm === 'usdt') return '1 USDT / $1';
    return '—';
  }, [appSettings.ghs_per_usd, appSettings.ngn_per_usd, kind, row]);

  const footerNote = useMemo(() => {
    if (!row) return '';
    const c = row.category as ActivityCategory;
    if (c === 'earn_watch') return 'Coins from this activity are reflected in your wallet balance.';
    if (c === 'purchase_sp' || c === 'fund_wallet' || c === 'gas_topup') {
      return 'Amounts and status come from your linked wallet activity log.';
    }
    if (c === 'withdraw') return 'Withdrawal updates when processing completes.';
    return 'This receipt reflects a row from your activity history.';
  }, [row]);

  const titleLine = row
    ? tone?.ok
      ? 'Transaction Successful'
      : tone?.warn
        ? 'In Progress'
        : 'Update'
    : 'Receipt';

  const showOverlay = initialBusy || refreshing;

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </Pressable>
          <Text style={styles.h1}>Receipt</Text>
        </View>

        <ScrollView
          refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
          contentContainerStyle={[styles.container, { paddingTop: topPad + 86, paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}>
          {!uid ? (
            <View style={styles.centerBox}>
              <Text style={styles.muted}>Sign in to view this receipt.</Text>
              <Pressable onPress={() => router.push('/login')} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Sign in</Text>
              </Pressable>
            </View>
          ) : !activityId ? (
            <View style={styles.centerBox}>
              <Text style={styles.muted}>Missing transaction id.</Text>
            </View>
          ) : initialBusy && !row ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={vibeColors.secondary} />
            </View>
          ) : !row ? (
            <View style={styles.centerBox}>
              <Ionicons name="document-text-outline" size={40} color="rgba(255,255,255,0.25)" />
              <Text style={styles.title}>Not found</Text>
              <Text style={styles.muted}>This activity is not available or was removed.</Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.cardTopGradient} />

                <View style={styles.cardBody}>
                  <Animated.View
                    style={[
                      styles.statusIconWrap,
                      { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] },
                      tone?.ok && { backgroundColor: 'rgba(34,197,94,0.10)' },
                      tone?.warn && !tone.ok && { backgroundColor: 'rgba(250,204,21,0.10)' },
                      !tone?.ok && !tone?.warn && { backgroundColor: 'rgba(239,68,68,0.10)' },
                    ]}>
                    <Ionicons
                      name={tone?.icon ?? 'receipt'}
                      size={30}
                      color={tone?.ok ? 'rgba(34,197,94,0.95)' : tone?.warn ? '#facc15' : 'rgba(239,68,68,0.95)'}
                    />
                  </Animated.View>
                  <Text style={styles.title}>{titleLine}</Text>
                  <Text style={styles.timestamp}>{formatActivityWhen(row.created_at)}</Text>

                  <View style={styles.amountBlock}>
                    <Text style={styles.amountLabel}>Total Amount</Text>
                    <Text style={styles.amountValue}>{formatActivityAmount(row)}</Text>
                  </View>

                  <View style={styles.details}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeft}>Transaction Type</Text>
                      <Text style={styles.detailRight}>{row.title}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeft}>Payment Method</Text>
                      <Text style={styles.detailRight}>{paymentMethodLabel}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeft}>Exchange Rate</Text>
                      <Text style={styles.detailRight}>{exchangeRateLabel}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeft}>Reference ID</Text>
                      <Text style={styles.detailMono} selectable>
                        {row.id}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLeft}>Status</Text>
                      <Text
                        style={[
                          styles.statusPill,
                          tone?.ok && { color: 'rgba(34,197,94,0.95)', backgroundColor: 'rgba(34,197,94,0.10)' },
                          tone?.warn && !tone?.ok && { color: '#facc15', backgroundColor: 'rgba(250,204,21,0.10)' },
                          !tone?.ok &&
                            !tone?.warn && { color: 'rgba(239,68,68,0.95)', backgroundColor: 'rgba(239,68,68,0.10)' },
                        ]}>
                        {row.status}
                      </Text>
                    </View>
                    {row.subtitle ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLeft}>Details</Text>
                        <Text style={[styles.detailRight, { flexShrink: 1 }]}>{row.subtitle}</Text>
                      </View>
                    ) : null}
                    {metaRows.map((m) => (
                      <View key={m.label} style={styles.detailRow}>
                        <Text style={styles.detailLeft}>{m.label}</Text>
                        <Text style={styles.detailRight} selectable>
                          {m.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.cardFoot}>
                  <View style={styles.infoRow}>
                    <View style={styles.infoIcon}>
                      <Ionicons name="information-circle" size={18} color={vibeColors.secondary} />
                    </View>
                    <Text style={styles.infoText}>{footerNote}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.btnStack}>
                <Pressable
                  onPress={() => router.replace('/history?tab=purchases')}
                  style={({ pressed }) => [styles.shareBtn, pressed && { transform: [{ scale: 0.98 }] }]}>
                  <Ionicons name="share-social" size={18} color="#000" />
                  <Text style={styles.shareText}>SHARE RECEIPT</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.replace('/(tabs)/wallet')}
                  style={({ pressed }) => [styles.doneBtn, pressed && { transform: [{ scale: 0.98 }] }]}>
                  <Text style={styles.doneText}>DONE</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
        <PullRefreshSkeletonOverlay visible={showOverlay && Boolean(uid && activityId)} />
      </View>
    </VibeScreen>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 24,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: -0.2 },

  container: { paddingHorizontal: 24, gap: 18, alignItems: 'center' },
  centerBox: {
    width: '100%',
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  muted: { color: vibeColors.muted, fontWeight: '600', fontSize: 13, textAlign: 'center' },
  primaryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: vibeColors.secondary,
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  card: {
    width: '100%',
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTopGradient: {
    height: 8,
    width: '100%',
    backgroundColor: vibeColors.primary,
  },
  cardBody: { padding: 24, alignItems: 'center' },
  statusIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34,197,94,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { color: '#fff', fontWeight: '900', fontSize: 16, marginBottom: 4 },
  timestamp: { color: vibeColors.muted, fontWeight: '700', fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  amountBlock: { marginTop: 20, marginBottom: 18, alignItems: 'center' },
  amountLabel: { color: vibeColors.muted, fontWeight: '900', fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 },
  amountValue: { color: '#fff', fontWeight: '900', fontSize: 36, letterSpacing: -0.6 },

  details: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderStyle: 'dashed',
    paddingTop: 16,
    gap: 12,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detailLeft: { color: vibeColors.muted, fontWeight: '600', fontSize: 12 },
  detailRight: { color: '#fff', fontWeight: '900', fontSize: 12, flexShrink: 1, textAlign: 'right' },
  detailMono: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.2, flexShrink: 1, textAlign: 'right' },
  statusPill: {
    color: 'rgba(34,197,94,0.95)',
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: '900',
    fontSize: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  cardFoot: { padding: 18, backgroundColor: 'rgba(0,0,0,0.40)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(29,161,242,0.10)', alignItems: 'center', justifyContent: 'center' },
  infoText: { color: vibeColors.muted, fontSize: 10, fontWeight: '600', lineHeight: 15, flex: 1, fontStyle: 'italic' },

  btnStack: { width: '100%', gap: 12 },
  shareBtn: {
    height: 58,
    borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  shareText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1.2 },
  doneBtn: {
    height: 58,
    borderRadius: 999,
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1.2 },
});
