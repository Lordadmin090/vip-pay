import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { VibeBottomNav } from '@/components/vibepay/bottom-nav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import {
  categoryVisual,
  formatActivityAmount,
  formatActivityWhenShort,
  groupActivitiesForSections,
} from '@/lib/activity-display';
import {
  type ActivityCategory,
  isEarningCategory,
  isPurchaseCategory,
  isWithdrawCategory,
} from '@/lib/wallet-activities';
import { useAccountData } from '@/hooks/use-account-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useWalletActivities } from '@/hooks/use-wallet-activities';

export default function HistoryScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = useMemo(() => {
    if (params?.tab === 'purchases') return 'purchases';
    if (params?.tab === 'withdraws') return 'withdraws';
    return 'earnings';
  }, [params?.tab]);

  const [tab, setTab] = useState<'earnings' | 'purchases' | 'withdraws'>(initialTab);
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);

  const { session, refresh: refreshAccount } = useAccountData();
  const uid = session?.user?.id;
  const { activities, loading: activitiesLoading, refresh: refreshActivities } = useWalletActivities(uid);

  const refreshAll = useCallback(async () => {
    await refreshAccount();
    await refreshActivities();
  }, [refreshAccount, refreshActivities]);

  const { refreshing, onRefresh } = usePullToRefresh(refreshAll);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll])
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const filtered = useMemo(() => {
    const list = activities.filter((a) => {
      const c = a.category as ActivityCategory;
      if (tab === 'earnings') return isEarningCategory(c);
      if (tab === 'purchases') return isPurchaseCategory(c);
      return isWithdrawCategory(c);
    });
    return list;
  }, [activities, tab]);

  const earningSections = useMemo(() => groupActivitiesForSections(filtered), [filtered]);

  const statusStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending') return styles.pendingStatusPending;
    if (s === 'failed' || s === 'rejected') return styles.pendingStatusRejected;
    return styles.pendingStatusApproved;
  };

  const showSkeleton = refreshing || activitiesLoading;

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
        <View style={[styles.floatingHeader, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
          <Text style={styles.h1}>History</Text>
          <Pressable style={({ pressed }) => [styles.headerBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
            <Ionicons name="filter" size={18} color="#fff" />
          </Pressable>
        </View>
        <ScrollView
          refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
          contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
          showsVerticalScrollIndicator={false}>
          {!uid ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sign in to see history</Text>
              <Text style={styles.emptySub}>Your earnings, purchases, and withdrawals will appear here.</Text>
              <Pressable onPress={() => router.push('/login')} style={styles.signInBtn}>
                <Text style={styles.signInText}>Sign in</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.segmentWrap}>
                <Pressable
                  onPress={() => setTab('earnings')}
                  style={[styles.segmentBtn, tab === 'earnings' ? styles.segmentBtnActive : null]}>
                  <Text style={[styles.segmentText, tab === 'earnings' ? styles.segmentTextActive : null]}>Earnings</Text>
                </Pressable>
                <Pressable
                  onPress={() => setTab('purchases')}
                  style={[styles.segmentBtn, tab === 'purchases' ? styles.segmentBtnActive : null]}>
                  <Text style={[styles.segmentText, tab === 'purchases' ? styles.segmentTextActive : null]}>Purchases</Text>
                </Pressable>
                <Pressable
                  onPress={() => setTab('withdraws')}
                  style={[styles.segmentBtn, tab === 'withdraws' ? styles.segmentBtnActive : null]}>
                  <Text style={[styles.segmentText, tab === 'withdraws' ? styles.segmentTextActive : null]}>Withdraws</Text>
                </Pressable>
              </View>

              {tab === 'earnings' ? (
                earningSections.length === 0 ? (
                  <EmptyTab message="Complete videos to earn coins — activity will show here." />
                ) : (
                  earningSections.map((sec) => (
                    <View key={sec.section} style={styles.section}>
                      <Text style={styles.sectionLabel}>{sec.section}</Text>
                      {sec.rows.map((it) => {
                        const vis = categoryVisual(it.category as ActivityCategory);
                        return (
                          <Pressable
                            key={it.id}
                            onPress={() => router.push({ pathname: '/transaction-details', params: { id: it.id } })}
                            style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}>
                            <View style={styles.rowLeft}>
                              <View style={[styles.rowIcon, { backgroundColor: vis.iconBg }]}>
                                <Ionicons name={vis.icon} size={20} color={vis.iconColor} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.rowTitle}>{it.title}</Text>
                                <Text style={styles.rowSub}>{formatActivityWhenShort(it.created_at)}</Text>
                              </View>
                            </View>
                            <View style={styles.rowRight}>
                              <Text style={styles.rowAmtCoins}>{formatActivityAmount(it)}</Text>
                              <Text style={styles.statusPill}>{it.status}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))
                )
              ) : tab === 'purchases' ? (
                filtered.length === 0 ? (
                  <EmptyTab message="When you buy scroll points or add funds, those purchases appear here." />
                ) : (
                  <View style={styles.pendingList}>
                    {filtered.map((it) => {
                      const vis = categoryVisual(it.category as ActivityCategory);
                      const amt = formatActivityAmount(it);
                      return (
                        <View key={it.id} style={styles.pendingCard}>
                          <View style={styles.pendingTop}>
                            <View style={styles.pendingLeft}>
                              <View style={[styles.pendingIcon, { backgroundColor: vis.iconBg }]}>
                                <Ionicons name={vis.icon} size={18} color={vis.iconColor} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.pendingTitle}>{it.title}</Text>
                                <Text style={styles.pendingSub}>{formatActivityWhenShort(it.created_at)}</Text>
                                {it.subtitle ? (
                                  <Text style={[styles.pendingSub, { marginTop: 4 }]} numberOfLines={2}>
                                    {it.subtitle}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                            <View style={styles.pendingRight}>
                              <Text style={styles.pendingAmt}>{amt}</Text>
                              <Text style={statusStyle(it.status)}>{it.status}</Text>
                            </View>
                          </View>
                          <View style={styles.pendingFooter}>
                            <Text style={styles.pendingId}>ID: {it.id.slice(0, 8)}…</Text>
                            <Pressable
                              onPress={() => router.push({ pathname: '/transaction-details', params: { id: it.id } })}
                              style={({ pressed }) => [styles.pendingDetails, pressed && { opacity: 0.85 }]}>
                              <Text style={styles.pendingDetailsText}>Details</Text>
                              <Ionicons name="chevron-forward" size={14} color={vibeColors.secondary} />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )
              ) : filtered.length === 0 ? (
                <EmptyTab message="No withdrawals recorded yet. Request a payout after you convert coins." />
              ) : (
                <View style={styles.pendingList}>
                  {filtered.map((it) => {
                    const vis = categoryVisual(it.category as ActivityCategory);
                    return (
                      <Pressable
                        key={it.id}
                        onPress={() => router.push({ pathname: '/transaction-details', params: { id: it.id } })}
                        style={({ pressed }) => [styles.pendingCard, pressed && { opacity: 0.95 }]}>
                        <View style={styles.pendingTop}>
                          <View style={styles.pendingLeft}>
                            <View style={[styles.pendingIcon, { backgroundColor: vis.iconBg }]}>
                              <Ionicons name={vis.icon} size={18} color={vis.iconColor} />
                            </View>
                            <View>
                              <Text style={styles.pendingTitle}>{it.title}</Text>
                              <Text style={styles.pendingSub}>{formatActivityWhenShort(it.created_at)}</Text>
                            </View>
                          </View>
                          <View style={styles.pendingRight}>
                            <Text style={styles.pendingAmt}>{formatActivityAmount(it)}</Text>
                            <Text style={statusStyle(it.status)}>{it.status}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
        <PullRefreshSkeletonOverlay visible={Boolean(uid) && showSkeleton} />
        <VibeBottomNav />
      </View>
    </VibeScreen>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <View style={styles.emptyTab}>
      <Ionicons name="receipt-outline" size={44} color="rgba(255,255,255,0.25)" />
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptySub}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  container: {
    padding: 18,
    paddingBottom: 140,
    gap: 18,
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
  h1: { color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: -0.3 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  segmentWrap: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: vibeColors.primary,
  },
  segmentText: {
    color: vibeColors.muted,
    fontWeight: '900',
    fontSize: 12,
  },
  segmentTextActive: { color: '#fff' },
  section: { gap: 12 },
  sectionLabel: {
    paddingHorizontal: 8,
    color: vibeColors.muted,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  row: {
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  rowSub: {
    color: vibeColors.muted,
    fontWeight: '800',
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  rowRight: { alignItems: 'flex-end' },
  rowAmtCoins: {
    color: '#facc15',
    fontWeight: '900',
    fontSize: 12,
  },
  statusPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.10)',
    color: 'rgba(34,197,94,0.85)',
    fontWeight: '900',
    fontSize: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },

  pendingList: { gap: 12 },
  pendingCard: {
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 32,
    padding: 18,
    gap: 14,
  },
  pendingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  pendingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  pendingIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { color: '#fff', fontWeight: '900', fontSize: 13 },
  pendingSub: {
    marginTop: 2,
    color: vibeColors.muted,
    fontWeight: '800',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  pendingRight: { alignItems: 'flex-end' },
  pendingAmt: { color: '#fff', fontWeight: '900', fontSize: 13 },
  pendingStatusPending: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(250,204,21,0.10)',
    color: '#facc15',
    fontWeight: '900',
    fontSize: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  pendingStatusApproved: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.10)',
    color: 'rgba(34,197,94,0.85)',
    fontWeight: '900',
    fontSize: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  pendingStatusRejected: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(239,68,68,0.10)',
    color: 'rgba(239,68,68,0.90)',
    fontWeight: '900',
    fontSize: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  pendingFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingId: { color: vibeColors.muted, fontWeight: '800', fontSize: 10 },
  pendingDetails: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pendingDetailsText: { color: vibeColors.secondary, fontWeight: '900', fontSize: 11 },

  emptyWrap: {
    paddingVertical: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  emptyTab: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(18,18,18,0.45)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: { color: '#fff', fontWeight: '900', fontSize: 16, textAlign: 'center' },
  emptySub: {
    color: vibeColors.muted,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  signInBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: vibeColors.secondary,
  },
  signInText: { color: '#fff', fontWeight: '900', fontSize: 13 },
});
