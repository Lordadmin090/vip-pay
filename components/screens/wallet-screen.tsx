import React, { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VibeBottomNav } from '@/components/vibepay/bottom-nav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GoldCoin from '@/assets/vibepay/icons/50cent.svg';
import ScrollIcon from '@/assets/vibepay/icons/scroll.svg';
import { useAccountData } from '@/hooks/use-account-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useWalletActivities } from '@/hooks/use-wallet-activities';
import {
  categoryVisual,
  formatActivityAmount,
  formatActivityWhenShort,
} from '@/lib/activity-display';
import type { ActivityCategory } from '@/lib/wallet-activities';
import {
  hydrateWalletFromServer,
  resetWalletStore,
  useCoinBalance,
  useScrollPoints,
  useShopWalletBalance,
} from '@/lib/wallet-store';

function fmtCoins(n: number) {
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const { wallet, loading, refresh, session, error } = useAccountData();
  const uid = session?.user?.id;
  const { activities, loading: activitiesLoading, refresh: refreshActivities } = useWalletActivities(uid);

  const refreshAll = useCallback(async () => {
    await refresh();
    await refreshActivities();
  }, [refresh, refreshActivities]);

  const { refreshing, onRefresh } = usePullToRefresh(refreshAll);
  const showSkeleton = loading || refreshing || activitiesLoading;
  const shopWalletUsd = useShopWalletBalance();
  const coins = useCoinBalance();
  const scrollPts = useScrollPoints();

  const recentActivities = React.useMemo(() => {
    // Wallet page should only show wallet-related events:
    // - wallet top-ups (pending/approved)
    // - gas top-ups
    // - conversions
    // - scroll point purchases
    return activities.filter((a) => {
      const c = a.category as ActivityCategory;
      if (c === 'fund_wallet' || c === 'gas_topup' || c === 'purchase_sp') return true;
      if (c === 'withdraw') {
        const ref = String((a.meta as any)?.reference_type ?? '').toLowerCase();
        const title = String(a.title ?? '').toLowerCase();
        // Show both conversions and real withdrawals.
        return ref === 'conversion' || title.includes('conversion') || ref === 'withdrawal' || title.includes('withdraw');
      }
      return false;
    });
  }, [activities]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  useEffect(() => {
    if (wallet) {
      hydrateWalletFromServer(wallet);
      return;
    }
    if (!loading && !session?.user?.id) {
      resetWalletStore();
    }
  }, [wallet, loading, session?.user?.id]);

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
      <View style={[styles.floatingHeader, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <Text style={styles.h1}>Wallet</Text>
        <Pressable
          onPress={() => router.push('/notification')}
          style={({ pressed }) => [styles.headerBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Ionicons name="notifications" size={18} color="#fff" />
        </Pressable>
      </View>
      <ScrollView
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
        showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.bannerErr}>{error}</Text> : null}
        <View style={styles.hero}>
          <View pointerEvents="none" style={styles.heroGradient} />
          <View pointerEvents="none" style={styles.heroBlob} />
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Coin Balance</Text>
          </View>
          <View style={styles.balanceRow}>
            <View style={styles.coinIcon}>
              <GoldCoin width={22} height={22} />
            </View>
            <Text style={styles.balance}>{fmtCoins(coins)}</Text>
            <Text style={styles.balanceUnit}>COINS</Text>
          </View>
          <View style={styles.quickGrid}>
            <View style={styles.quickCard}>
              <Text style={styles.quickLabel}>Wallet (shop)</Text>
              <View style={styles.quickRow}>
                <Ionicons name="wallet" size={14} color={vibeColors.secondary} />
                <Text style={styles.quickValue}>${shopWalletUsd.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.quickCard}>
              <Text style={styles.quickLabel}>Scroll Points</Text>
              <View style={styles.quickRow}>
                <ScrollIcon width={14} height={14} />
                <Text style={styles.quickValue}>
                  {Number.isFinite(scrollPts) ? Math.round(scrollPts).toLocaleString('en-US') : '0'} SP
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              onPress={() => router.push('/fund-sp')}
              style={({ pressed }) => [styles.ctaPrimary, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.ctaPrimaryText}>Fund Wallet</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/withdrawal')}
              style={({ pressed }) => [styles.ctaLight, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Ionicons name="send" size={18} color="#000" />
              <Text style={styles.ctaLightText}>Withdraw</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.sectionLink}>View All</Text>
          </Pressable>
        </View>

        {!uid ? (
          <View style={styles.activityEmpty}>
            <Ionicons name="receipt-outline" size={28} color="rgba(255,255,255,0.35)" />
            <Text style={styles.activityEmptyTitle}>Sign in for activity</Text>
            <Text style={styles.activityEmptySub}>Your recent wallet events will appear here.</Text>
          </View>
        ) : recentActivities.length === 0 ? (
          <View style={styles.activityEmpty}>
            <Ionicons name="receipt-outline" size={28} color="rgba(255,255,255,0.35)" />
            <Text style={styles.activityEmptyTitle}>No transactions yet</Text>
            <Text style={styles.activityEmptySub}>
              Fund your wallet or earn coins from watching — activity will show here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {recentActivities.slice(0, 5).map((it) => {
              const vis = categoryVisual(it.category as ActivityCategory);
              const amt = formatActivityAmount(it);
              const neg =
                (it.amount_usd != null && Number(it.amount_usd) < 0) ||
                (it.amount_coins != null && Number(it.amount_coins) < 0);
              const isWithdraw = it.category === 'withdraw';
              return (
                <Pressable
                  key={it.id}
                  onPress={() => router.push({ pathname: '/transaction-details', params: { id: it.id } })}
                  style={({ pressed }) => [styles.activity, pressed && { opacity: 0.92 }]}>
                  <View style={styles.activityLeft}>
                    <View style={[styles.activityIcon, { backgroundColor: vis.iconBg }]}>
                      <Ionicons name={vis.icon} size={20} color={vis.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {it.title}
                      </Text>
                      <Text style={styles.activitySub}>{formatActivityWhenShort(it.created_at)}</Text>
                    </View>
                  </View>
                  <View style={styles.activityRight}>
                    <Text
                      style={
                        isWithdraw
                          ? styles.activityAmountCash
                          : neg
                            ? styles.activityAmountNeg
                            : styles.activityAmountPos
                      }>
                      {amt}
                    </Text>
                    <Text style={styles.activityStatus}>{it.status}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <PullRefreshSkeletonOverlay visible={showSkeleton} />
      <VibeBottomNav />
      </View>
    </VibeScreen>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  container: {
    padding: 18,
    gap: 12,
  },
  bannerErr: {
    color: '#fecaca',
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontWeight: '800',
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 24,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  h1: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    position: 'relative',
    backgroundColor: 'rgba(18,18,18,0.70)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 28,
    padding: 16,
    overflow: 'hidden',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,161,242,0.06)',
  },
  heroBlob: {
    position: 'absolute',
    right: -24,
    top: -24,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(29,161,242,0.20)',
    opacity: 0.9,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroLabel: {
    color: vibeColors.muted,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  coinIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 30,
    letterSpacing: -0.5,
  },
  balanceUnit: {
    color: vibeColors.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  quickCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quickLabel: {
    color: vibeColors.muted,
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickValue: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ctaPrimary: {
    flex: 1.5,
    height: 50,
    borderRadius: 18,
    backgroundColor: vibeColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaPrimaryText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  ctaLight: {
    flex: 1,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaLightText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
  },
  sectionHead: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  sectionLink: {
    color: vibeColors.secondary,
    fontWeight: '900',
    fontSize: 12,
  },
  activity: {
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  activityIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  activitySub: {
    marginTop: 2,
    color: vibeColors.muted,
    fontWeight: '700',
    fontSize: 10,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmountPos: {
    color: '#facc15',
    fontWeight: '900',
    fontSize: 12,
  },
  activityAmountNeg: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 12,
  },
  activityAmountCash: {
    color: '#22c55e',
    fontWeight: '900',
    fontSize: 12,
  },
  activityStatus: {
    marginTop: 2,
    color: vibeColors.muted,
    fontWeight: '700',
    fontSize: 10,
  },
  activityEmpty: {
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  activityEmptyTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'center',
  },
  activityEmptySub: {
    color: vibeColors.muted,
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 280,
  },
});

