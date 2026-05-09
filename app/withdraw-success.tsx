import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { vibeColors } from '@/components/vibepay/vibe-screen';
import { useAccountData } from '@/hooks/use-account-data';
import { supabase } from '@/lib/supabase';

export default function WithdrawSuccessScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const bottomPad = Math.max(insets.bottom, 16);

  const { session } = useAccountData();
  const uid = session?.user?.id ?? null;

  type LatestWithdrawal = {
    id: string;
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

  const [latest, setLatest] = useState<LatestWithdrawal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const bounce = useRef(new Animated.Value(0)).current;
  const ping = useRef(new Animated.Value(0)).current;

  const loadLatest = useCallback(async () => {
    if (!uid) {
      setLatest(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadErr(null);
    const { data, error } = await supabase
      .from('withdrawals')
      .select(
        'id,method,status,amount_usd,bank_name,account_name,account_number,crypto_asset,network,wallet_address,created_at'
      )
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setLatest(null);
      setLoadErr(error.message);
      setLoading(false);
      return;
    }
    setLatest((data as LatestWithdrawal) ?? null);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    Animated.timing(bounce, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ping, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(ping, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, ping]);

  useFocusEffect(
    useCallback(() => {
      void loadLatest();
    }, [loadLatest])
  );

  const bounceStyle = useMemo(() => {
    const scale = bounce.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.7, 1.08, 1] });
    return { transform: [{ scale }] };
  }, [bounce]);

  const pingStyle = useMemo(() => {
    const scale = ping.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] });
    const opacity = ping.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
    return { transform: [{ scale }], opacity };
  }, [ping]);

  const detailsLabel = useMemo(() => {
    if (!latest) return null;
    const method = (latest.method || '').toLowerCase();
    if (method === 'bank') {
      const bank = latest.bank_name ?? 'Bank';
      const acct = latest.account_number ? `•••• ${latest.account_number.slice(-4)}` : '—';
      return `${bank} • ${acct}`;
    }
    const asset = latest.crypto_asset ?? 'Crypto';
    const net = latest.network ?? '—';
    const addr = latest.wallet_address ? `${latest.wallet_address.slice(0, 6)}…${latest.wallet_address.slice(-4)}` : '—';
    return `${asset} • ${net} • ${addr}`;
  }, [latest]);

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.bg}>
        <View style={styles.glow} />
      </View>

      <View style={[styles.content, { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 }]}>
        <View style={styles.hero}>
          <View style={styles.heroWrap}>
            <Animated.View style={[styles.heroOuter, bounceStyle]}>
              <View style={styles.heroInner}>
                <Ionicons name="checkmark-done" size={44} color="#fff" />
              </View>
            </Animated.View>
            <Animated.View style={[styles.heroPing, pingStyle]} />
          </View>
        </View>

        <Text style={styles.title}>Withdrawal Request Sent!</Text>
        <Text style={styles.sub}>
          Your funds are being processed. They will reflect in your account within{' '}
          <Text style={styles.subStrong}>15-30 minutes</Text>.
        </Text>

        <View style={styles.card}>
          {loading ? (
            <View style={{ paddingVertical: 10, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={vibeColors.secondary} />
              <Text style={styles.cardFoot}>Loading latest withdrawal…</Text>
            </View>
          ) : loadErr ? (
            <View style={{ paddingVertical: 6, alignItems: 'center', gap: 8 }}>
              <Text style={[styles.cardFoot, { color: vibeColors.primary }]} numberOfLines={3}>
                {loadErr}
              </Text>
              <Pressable onPress={() => void loadLatest()} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : latest ? (
            <>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Reference ID</Text>
                <Text style={styles.cardMono}>#{latest.id.slice(0, 8).toUpperCase()}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Amount (USD)</Text>
                <Text style={styles.cardAmt}>${Number(latest.amount_usd ?? 0).toFixed(2)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Status</Text>
                <Text style={styles.cardMono}>{(latest.status || 'pending').toUpperCase()}</Text>
              </View>
              {detailsLabel ? (
                <View style={[styles.cardRow, { marginBottom: 2 }]}>
                  <Text style={styles.cardLabel}>Payout</Text>
                  <Text style={styles.cardMono} numberOfLines={1}>
                    {detailsLabel}
                  </Text>
                </View>
              ) : null}
              <View style={styles.cardDivider} />
              <Text style={styles.cardFoot}>
                We saved your request and sent it to admin for review.
              </Text>
            </>
          ) : (
            <View style={{ paddingVertical: 6, alignItems: 'center', gap: 8 }}>
              <Text style={styles.cardFoot}>No withdrawal record found yet.</Text>
              <Pressable onPress={() => void loadLatest()} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.retryText}>Refresh</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.btnStack}>
          <Pressable
            onPress={() => router.replace('/(tabs)/wallet')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { transform: [{ scale: 0.98 }] }]}>
            <Text style={styles.primaryText}>BACK TO WALLET</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="share-social" size={18} color="#fff" />
            <Text style={styles.secondaryText}>Share Proof</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  bg: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  glow: {
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(29,161,242,0.10)',
    opacity: 1,
  },
  content: { width: '100%', maxWidth: 340, alignItems: 'center' },
  hero: { marginBottom: 20 },
  heroWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  heroOuter: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(29,161,242,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: vibeColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: vibeColors.secondary,
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  heroPing: {
    position: 'absolute',
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 2,
    borderColor: 'rgba(29,161,242,0.20)',
  },
  title: { color: '#fff', fontWeight: '900', fontSize: 26, letterSpacing: -0.4, marginBottom: 8, textAlign: 'center' },
  sub: { color: vibeColors.muted, fontWeight: '600', fontSize: 13, lineHeight: 18, marginBottom: 18, textAlign: 'center', maxWidth: 240 },
  subStrong: { color: '#fff', fontWeight: '900' },
  card: {
    width: '100%',
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardLabel: { color: vibeColors.muted, fontWeight: '900', fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
  cardMono: { color: '#fff', fontWeight: '900', fontSize: 10, letterSpacing: 0.2 },
  cardAmt: { color: vibeColors.secondary, fontWeight: '900', fontSize: 16 },
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 8, marginBottom: 10 },
  cardFoot: { color: vibeColors.muted, fontWeight: '600', fontSize: 10, textAlign: 'center' },
  cardFootStrong: { color: '#fff', fontWeight: '900' },
  btnStack: { width: '100%', gap: 12 },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 999,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  primaryText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1.2 },
  secondaryBtn: { width: '100%', height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  retryText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 0.6 },
});

