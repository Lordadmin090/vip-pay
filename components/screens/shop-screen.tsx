import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { router, useFocusEffect } from 'expo-router';
import { VibeBottomNav } from '@/components/vibepay/bottom-nav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScrollIcon from '@/assets/vibepay/icons/scroll.svg';
import { useAccountData } from '@/hooks/use-account-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { fetchActivePackages, type PackageRow } from '@/lib/packages';
import { purchaseScrollPack } from '@/lib/wallet-remote';
import { hydrateWalletFromServer, resetWalletStore, useShopWalletBalance } from '@/lib/wallet-store';

type PackTag = 'muted' | 'popular' | 'secondary' | 'cyan';

type ShopPack = {
  id: string;
  tier: string;
  tag: PackTag;
  amountLabel: string;
  sp: number;
  bonus: number;
  price: number;
  desc: string;
  highlight?: boolean;
};

type PackTheme = {
  key: 'starter' | 'bronze' | 'silver' | 'gold' | 'diamond' | 'popular' | 'default';
  accent: string;
  glow: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  cardBg: string;
  border: string;
  label: string;
};

function themeForPack(pack: ShopPack): PackTheme {
  const t = (pack.tier || '').toLowerCase();
  if (pack.highlight || pack.tag === 'popular') {
    return {
      key: 'popular',
      accent: vibeColors.primary,
      glow: 'rgba(254,44,85,0.30)',
      icon: 'sparkles',
      cardBg: 'rgba(254,44,85,0.10)',
      border: 'rgba(254,44,85,0.55)',
      label: 'Most popular',
    };
  }
  if (t.includes('diamond')) {
    return {
      key: 'diamond',
      accent: '#00F2FF',
      glow: 'rgba(0,242,255,0.30)',
      icon: 'diamond',
      cardBg: 'rgba(0,242,255,0.08)',
      border: 'rgba(0,242,255,0.35)',
      label: 'Diamond',
    };
  }
  if (t.includes('gold')) {
    return {
      key: 'gold',
      accent: '#F7C948',
      glow: 'rgba(247,201,72,0.28)',
      icon: 'star',
      cardBg: 'rgba(247,201,72,0.08)',
      border: 'rgba(247,201,72,0.32)',
      label: 'Gold',
    };
  }
  if (t.includes('silver')) {
    return {
      key: 'silver',
      accent: '#BFC7D5',
      glow: 'rgba(191,199,213,0.22)',
      icon: 'trophy',
      cardBg: 'rgba(191,199,213,0.07)',
      border: 'rgba(191,199,213,0.22)',
      label: 'Silver',
    };
  }
  if (t.includes('bronze')) {
    return {
      key: 'bronze',
      accent: '#D18B5B',
      glow: 'rgba(209,139,91,0.22)',
      icon: 'flame',
      cardBg: 'rgba(209,139,91,0.07)',
      border: 'rgba(209,139,91,0.22)',
      label: 'Bronze',
    };
  }
  if (t.includes('starter') || t.includes('basic')) {
    return {
      key: 'starter',
      accent: '#7CFFB2',
      glow: 'rgba(124,255,178,0.18)',
      icon: 'leaf',
      cardBg: 'rgba(124,255,178,0.06)',
      border: 'rgba(124,255,178,0.18)',
      label: 'Starter',
    };
  }
  // Fallback to tag palette so “others” still look styled.
  if (pack.tag === 'cyan') {
    return {
      key: 'diamond',
      accent: '#00F2FF',
      glow: 'rgba(0,242,255,0.28)',
      icon: 'diamond',
      cardBg: 'rgba(0,242,255,0.07)',
      border: 'rgba(0,242,255,0.26)',
      label: pack.tier,
    };
  }
  if (pack.tag === 'secondary') {
    return {
      key: 'silver',
      accent: vibeColors.secondary,
      glow: 'rgba(29,161,242,0.22)',
      icon: 'trophy',
      cardBg: 'rgba(29,161,242,0.07)',
      border: 'rgba(29,161,242,0.22)',
      label: pack.tier,
    };
  }
  return {
    key: 'default',
    accent: '#FFFFFF',
    glow: 'rgba(255,255,255,0.10)',
    icon: 'star',
    cardBg: 'rgba(18,18,18,0.60)',
    border: 'rgba(255,255,255,0.10)',
    label: pack.tier,
  };
}

function mapPackageToShopPack(row: PackageRow, index: number): ShopPack {
  const tags: PackTag[] = ['muted', 'secondary', 'cyan', 'muted'];
  const tag: PackTag = row.is_popular ? 'popular' : tags[index % tags.length];
  const sp = Math.max(0, Math.round(Number(row.scroll_points)));
  const price = Number(row.price);
  return {
    id: row.id,
    tier: row.name,
    tag,
    amountLabel: `${sp.toLocaleString('en-US')} SP`,
    sp,
    bonus: 0,
    price: Number.isFinite(price) ? price : 0,
    desc: (row.description ?? '').trim() || 'Scroll point package',
    highlight: Boolean(row.is_popular),
  };
}

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const { wallet, session, loading, refresh } = useAccountData();
  const [packs, setPacks] = useState<ShopPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);

  const loadPacks = useCallback(async () => {
    setPacksLoading(true);
    try {
      const rows = await fetchActivePackages();
      setPacks(rows.map((r, i) => mapPackageToShopPack(r, i)));
    } finally {
      setPacksLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await refresh();
    await loadPacks();
  }, [refresh, loadPacks]);

  const { refreshing, onRefresh } = usePullToRefresh(refreshAll);

  /** Shop funding only — synced from `users.wallet_balance` via hydrate (never USD ready). */
  const shopWalletUsd = useShopWalletBalance();
  const scrollPts = wallet?.scroll_points ?? 0;

  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [alertText, setAlertText] = useState<string | null>(null);
  const alertY = React.useRef(new Animated.Value(-90)).current;

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
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

  const showAlert = useCallback(
    (msg: string) => {
      setAlertText(msg);
      alertY.stopAnimation();
      alertY.setValue(-90);
      Animated.sequence([
        Animated.spring(alertY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
        Animated.delay(2200),
        Animated.timing(alertY, { toValue: -90, duration: 260, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setAlertText(null);
      });
    },
    [alertY]
  );

  const tryBuy = useCallback(
    async (pack: ShopPack) => {
      const uid = session?.user?.id;
      if (!uid) {
        router.push('/login');
        return;
      }
      const totalSp = pack.sp + pack.bonus;
      setBusyPackId(pack.id);
      const { wallet: next, error } = await purchaseScrollPack(uid, pack.price, totalSp);
      setBusyPackId(null);
      if (error || !next) {
        showAlert(error ?? 'Purchase failed');
        return;
      }
      hydrateWalletFromServer(next);
      await refresh();
      showAlert(`Added ${totalSp.toLocaleString()} SP to your balance`);
    },
    [refresh, session?.user?.id, showAlert]
  );

  const showSkeleton = Boolean(session && (loading || refreshing || packsLoading));

  if (!loading && !session) {
    return (
      <VibeScreen>
        <View style={styles.flexFill}>
          <View style={[styles.header, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
            <Text style={styles.h1}>Shop Points</Text>
          </View>
          <ScrollView
            refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
            contentContainerStyle={[styles.guestWrap, { paddingTop: topPad + 100, paddingHorizontal: 28, flexGrow: 1 }]}>
            <Text style={styles.guestTitle}>Sign in to purchase</Text>
            <Text style={styles.guestSub}>Fund your shop wallet and buy scroll points with your account.</Text>
            <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [styles.guestBtn, pressed && { opacity: 0.92 }]}>
              <Text style={styles.guestBtnText}>Sign in</Text>
            </Pressable>
          </ScrollView>
          <PullRefreshSkeletonOverlay visible={refreshing} />
          <VibeBottomNav />
        </View>
      </VibeScreen>
    );
  }

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Shop Points</Text>
          <View style={styles.headerMetrics}>
            <View style={styles.balancePill}>
              <ScrollIcon width={16} height={16} />
              <Text style={styles.balanceText}>{Math.round(scrollPts).toLocaleString()} SP</Text>
            </View>
            <View style={styles.balancePill}>
              <Ionicons name="wallet" size={16} color={vibeColors.secondary} />
              <Text style={styles.balanceText}>${shopWalletUsd.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>

      {alertText ? (
        <Animated.View
          style={[styles.alertWrap, { top: topPad + 66, transform: [{ translateY: alertY }] }]}
          pointerEvents="none">
          <View style={[styles.alertPill, alertText.startsWith('Added') && styles.alertPillOk]}>
            <Ionicons name={alertText.startsWith('Added') ? 'checkmark-circle' : 'alert-circle'} size={16} color="#fff" />
            <Text style={styles.alertText}>{alertText}</Text>
          </View>
        </Animated.View>
      ) : null}

      <ScrollView
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Boost your earnings</Text>
          <Text style={styles.bannerBody}>
            Purchase scroll points with your shop wallet balance only (separate from USD ready). Each video uses 1 SP on the Watch feed.
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Shop wallet</Text>
          </View>
          <Ionicons name="sparkles" size={84} color="rgba(254,44,85,0.10)" style={styles.bannerIcon} />
        </View>

        {!packsLoading && packs.length === 0 ? (
          <View style={styles.emptyPacks}>
            <Ionicons name="cube-outline" size={32} color="rgba(255,255,255,0.25)" />
            <Text style={styles.emptyPacksTitle}>No packages available</Text>
            <Text style={styles.emptyPacksSub}>Add active packages in admin — pull to refresh.</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {packs.map((pack) => {
            const theme = themeForPack(pack);
            const busy = busyPackId === pack.id;
            const canAfford = shopWalletUsd + 1e-9 >= pack.price;

            const cardInner = (
              <>
                <View pointerEvents="none" style={[styles.planGlow, { backgroundColor: theme.glow }]} />
                <View pointerEvents="none" style={[styles.planGlow2, { backgroundColor: theme.glow }]} />
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(0,0,0,0.16)', borderColor: theme.border }]}>
                    <Ionicons name={theme.icon} size={22} color={theme.accent} />
                  </View>
                  <Text style={[styles.planLabel, { color: theme.accent }]}>{pack.tier}</Text>
                </View>
                <View style={styles.cardMid}>
                  <View style={styles.amountRow}>
                    <Text style={[styles.amount, pack.highlight && { fontSize: 30 }, theme.key !== 'default' && { color: '#fff' }]}>
                      {pack.amountLabel}
                    </Text>
                    {pack.bonus > 0 ? (
                      <Text style={[styles.bonus, { color: theme.accent }]}>
                        +{pack.bonus.toLocaleString()} Bonus
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.desc}>{pack.desc}</Text>
                </View>
                <Pressable
                  disabled={busy || !session}
                  onPress={() => tryBuy(pack)}
                  style={({ pressed }) => [
                    pack.highlight ? styles.buyPrimary : pack.tag === 'cyan' ? styles.buyCyan : pack.tag === 'secondary' ? styles.buyLight : styles.buyMuted,
                    pressed && { transform: [{ scale: 0.98 }] },
                    (busy || !canAfford) && { opacity: 0.55 },
                  ]}>
                  {busy ? (
                    <ActivityIndicator color={pack.highlight || pack.tag === 'cyan' ? '#fff' : '#000'} />
                  ) : (
                    <>
                      <Text
                        style={
                          pack.highlight
                            ? styles.buyPrimaryText
                            : pack.tag === 'cyan'
                              ? styles.buyCyanText
                              : pack.tag === 'secondary'
                                ? styles.buyLightText
                                : styles.buyMutedText
                        }>
                        Buy for ${pack.price.toFixed(2)}
                      </Text>
                      <Ionicons
                        name="cart"
                        size={18}
                        color={pack.highlight || pack.tag === 'cyan' ? '#fff' : '#000'}
                      />
                    </>
                  )}
                </Pressable>
              </>
            );

            if (pack.highlight) {
              return (
                <View key={pack.id} style={[styles.cardPopular, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Most popular</Text>
                  </View>
                  {cardInner}
                </View>
              );
            }

            if (theme.key === 'diamond') {
              return (
                <View key={pack.id} style={[styles.cardUltimate, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  {cardInner}
                  <Ionicons name="diamond" size={120} color="rgba(0,242,255,0.06)" style={styles.ultimateBgIcon} />
                </View>
              );
            }

            return (
              <View key={pack.id} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                {cardInner}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <PullRefreshSkeletonOverlay visible={showSkeleton} />
      <VibeBottomNav />
      </View>
    </VibeScreen>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  guestWrap: { flex: 1, justifyContent: 'center', gap: 12 },
  guestTitle: { color: '#fff', fontWeight: '900', fontSize: 22, textAlign: 'center' },
  guestSub: { color: vibeColors.muted, fontWeight: '700', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  guestBtn: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: vibeColors.secondary,
  },
  guestBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  alertWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 200,
    alignItems: 'center',
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(254,44,85,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  alertPillOk: {
    backgroundColor: 'rgba(34,197,94,0.92)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  alertText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 24,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerMetrics: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  h1: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: -0.3,
    flexShrink: 0,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(38,38,38,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  balanceText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    gap: 18,
  },
  banner: {
    borderRadius: 40,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(254,44,85,0.20)',
    backgroundColor: 'rgba(254,44,85,0.08)',
    overflow: 'hidden',
  },
  bannerTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 4,
  },
  bannerBody: {
    color: vibeColors.muted,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 18,
  },
  badge: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: vibeColors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bannerIcon: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },
  grid: {
    gap: 18,
  },
  card: {
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 32,
    padding: 24,
  },
  cardPopular: {
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 2,
    borderColor: 'rgba(254,44,85,0.50)',
    borderRadius: 40,
    padding: 24,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: [{ translateX: -60 }],
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: vibeColors.primary,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardUltimate: {
    backgroundColor: 'rgba(0,242,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,242,255,0.30)',
    borderRadius: 40,
    padding: 24,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planGlow: {
    position: 'absolute',
    top: -120,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 999,
    opacity: 0.9,
  },
  planGlow2: {
    position: 'absolute',
    bottom: -140,
    right: -110,
    width: 260,
    height: 260,
    borderRadius: 999,
    opacity: 0.75,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  planLabel: {
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardMid: {
    marginBottom: 18,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  amount: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 24,
  },
  bonus: {
    color: vibeColors.primary,
    fontWeight: '900',
    fontSize: 13,
  },
  desc: {
    color: vibeColors.muted,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 18,
  },
  buyPrimary: {
    height: 52,
    borderRadius: 999,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  buyPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  buyLight: {
    height: 52,
    borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  buyLightText: { color: '#000', fontWeight: '900', fontSize: 14 },
  buyCyan: {
    height: 52,
    borderRadius: 999,
    backgroundColor: '#00F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  buyCyanText: { color: '#000', fontWeight: '900', fontSize: 14 },
  buyMuted: {
    height: 52,
    borderRadius: 999,
    backgroundColor: 'rgba(38,38,38,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  buyMutedText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  emptyPacks: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(18,18,18,0.45)',
    gap: 8,
    marginBottom: 8,
  },
  emptyPacksTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  emptyPacksSub: { color: vibeColors.muted, fontWeight: '700', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  ultimateBgIcon: {
    position: 'absolute',
    right: -18,
    bottom: -22,
  },
});
