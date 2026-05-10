import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import {
  categoryVisual,
  formatActivityAmount,
  formatRelativeTime,
} from '@/lib/activity-display';
import type { ActivityCategory } from '@/lib/wallet-activities';
import { useAccountData } from '@/hooks/use-account-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useWalletActivities } from '@/hooks/use-wallet-activities';
import { requestNotificationsPermission } from '@/lib/permissions';
import { registerPushTokenBestEffort } from '@/lib/push';

export default function NotificationScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const { session, refresh: refreshAccount } = useAccountData();
  const uid = session?.user?.id;
  const { activities, loading, refresh: refreshActivities } = useWalletActivities(uid);
  const [notifPermAsked, setNotifPermAsked] = useState(false);

  useEffect(() => {
    if (!uid) return;
    if (notifPermAsked) return;
    setNotifPermAsked(true);
    void requestNotificationsPermission();
    void registerPushTokenBestEffort(uid);
  }, [uid, notifPermAsked]);

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

  const [readIds, setReadIds] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    return activities.slice(0, 40).map((a) => {
      const c = a.category as ActivityCategory;
      const vis = categoryVisual(c);
      let tone: 'primary' | 'secondary' | 'muted' = 'muted';
      if (c === 'earn_watch' || c === 'conversion') tone = 'primary';
      else if (c === 'purchase_sp' || c === 'fund_wallet' || c === 'gas_topup') tone = 'secondary';
      const icon =
        c === 'withdraw'
          ? ('cash' as const)
          : c === 'earn_watch'
            ? ('play' as const)
            : c === 'purchase_sp'
              ? ('cart-outline' as const)
              : ('notifications' as const);

      return {
        id: a.id,
        tone,
        title: a.title,
        time: formatRelativeTime(a.created_at),
        bodyPlain: [a.subtitle, formatActivityAmount(a)].filter(Boolean).join(' · ') || formatActivityAmount(a),
        icon,
        iconBg: vis.iconBg,
        iconColor: vis.iconColor,
      };
    });
  }, [activities]);

  const markAllRead = () => {
    const next: Record<string, boolean> = {};
    for (const it of items) next[it.id] = true;
    setReadIds(next);
  };

  const showSkeleton = loading || refreshing;

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </Pressable>
            <Text style={styles.h1}>Notifications</Text>
          </View>

          <Pressable onPress={markAllRead} style={({ pressed }) => [styles.markBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.markText}>Mark all read</Text>
          </Pressable>
        </View>

        <ScrollView
          refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.container, { paddingTop: topPad + 86 }]}>
          {!uid ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sign in to see notifications</Text>
              <Text style={styles.emptySub}>Wallet and watch activity will show up here.</Text>
              <Pressable onPress={() => router.push('/login')} style={styles.signInBtn}>
                <Text style={styles.signInText}>Sign in</Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="notifications-off-outline" size={44} color="rgba(255,255,255,0.22)" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySub}>
                When you earn, purchase, or withdraw, entries appear here from your activity log.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {items.map((it) => {
                const isRead = !!readIds[it.id];
                const toneBar =
                  it.tone === 'primary'
                    ? vibeColors.primary
                    : it.tone === 'secondary'
                      ? vibeColors.secondary
                      : 'rgba(255,255,255,0.12)';

                return (
                  <Pressable
                    key={it.id}
                    onPress={() => {
                      setReadIds((p) => ({ ...p, [it.id]: true }));
                      router.push({ pathname: '/transaction-details', params: { id: it.id } });
                    }}
                    style={({ pressed }) => [styles.card, isRead && styles.cardDim, pressed && { opacity: 0.92 }]}>
                    <View style={[styles.leftBar, { backgroundColor: toneBar }]} />
                    <View style={[styles.iconBox, { backgroundColor: it.iconBg }]}>
                      <Ionicons name={it.icon} size={22} color={it.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle}>{it.title}</Text>
                        <Text style={styles.cardTime}>{it.time}</Text>
                      </View>
                      <Text style={styles.cardBody}>{it.bodyPlain}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
        <PullRefreshSkeletonOverlay visible={Boolean(uid) && showSkeleton} />
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
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  markBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  markText: { color: vibeColors.secondary, fontWeight: '900', fontSize: 11 },

  container: { paddingHorizontal: 24, paddingBottom: 28 },

  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  cardDim: { opacity: 0.55 },
  leftBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitle: { color: '#fff', fontWeight: '900', fontSize: 14, flex: 1 },
  cardTime: { color: vibeColors.muted, fontWeight: '800', fontSize: 10 },
  cardBody: { marginTop: 6, color: 'rgba(255,255,255,0.72)', fontWeight: '600', fontSize: 12, lineHeight: 17 },

  emptyWrap: {
    paddingVertical: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
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
