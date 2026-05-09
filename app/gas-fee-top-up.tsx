import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { DEFAULT_APP_SETTINGS, type AppPlatformSettings, fetchAppSettings } from '@/lib/app-settings';

type PayChoice = 'ngn' | 'ghs' | 'usdt';

function ScannityLoaderBar({ width = 120, height = 22 }: { width?: number; height?: number }) {
  const opacity = React.useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.scannityBar,
        { width, height, opacity },
      ]}
    />
  );
}

export default function GasFeeTopUpScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const [selected, setSelected] = useState<PayChoice>('ngn');
  const [appSettings, setAppSettings] = useState<AppPlatformSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const refreshAll = useCallback(async () => {
    const s = await fetchAppSettings();
    setAppSettings(s);
    setSettingsLoaded(true);
  }, []);
  const { refreshing, onRefresh } = usePullToRefresh(refreshAll);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const usd = useMemo(() => {
    const s = appSettings ?? DEFAULT_APP_SETTINGS;
    return Number(s.gas_fee_topup_usd ?? 5);
  }, [appSettings]);
  const ngn = useMemo(() => {
    const s = appSettings ?? DEFAULT_APP_SETTINGS;
    return usd * Number(s.ngn_per_usd);
  }, [appSettings, usd]);
  const ghs = useMemo(() => {
    const s = appSettings ?? DEFAULT_APP_SETTINGS;
    return usd * Number(s.ghs_per_usd);
  }, [appSettings, usd]);

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.h1}>Gas Fee Top-up</Text>
      </View>

      <ScrollView
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={[styles.container, { paddingTop: topPad + 86 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="flame" size={28} color={vibeColors.primary} />
          </View>
          <Text style={styles.heroTitle}>Replenish Gas Fuel</Text>
          <Text style={styles.heroSub}>Fixed amount required for blockchain verification and instant withdrawals.</Text>
        </View>

        <View style={styles.amountCard}>
          <View style={styles.amountGlow} />
          <Text style={styles.amountLabel}>Top-up Amount</Text>
          {!settingsLoaded ? (
            <View style={styles.amountLoadingRow}>
              <ScannityLoaderBar width={160} height={44} />
            </View>
          ) : (
            <Text style={styles.amountValue}>${usd.toFixed(2)}</Text>
          )}
          <Text style={styles.amountHint}>Auto-renew not enabled</Text>
        </View>

        <Text style={styles.sectionTitle}>Select Payment Method</Text>

        <View style={styles.methodList}>
          <Pressable
            onPress={() => setSelected('ngn')}
            style={({ pressed }) => [
              styles.methodRow,
              selected === 'ngn' && styles.methodRowActive,
              pressed && { transform: [{ scale: 0.99 }] },
            ]}>
            <View style={[styles.methodIcon, { backgroundColor: 'rgba(29,161,242,0.10)' }]}>
              <Ionicons name="card" size={22} color={vibeColors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>NGN (Nigeria)</Text>
              <Text style={styles.methodSub}>
                {!settingsLoaded
                  ? '—'
                  : `~ ₦${ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
            </View>
            <View style={[styles.radio, selected === 'ngn' && styles.radioOn]}>
              <View style={[styles.radioDot, selected === 'ngn' && styles.radioDotOn]} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => setSelected('ghs')}
            style={({ pressed }) => [
              styles.methodRow,
              selected === 'ghs' && styles.methodRowActive,
              pressed && { transform: [{ scale: 0.99 }] },
            ]}>
            <View style={[styles.methodIcon, { backgroundColor: 'rgba(29,161,242,0.10)' }]}>
              <Ionicons name="wallet" size={22} color={vibeColors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>GHS (Ghana)</Text>
              <Text style={styles.methodSub}>
                {!settingsLoaded
                  ? '—'
                  : `~ GHS ${ghs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
            </View>
            <View style={[styles.radio, selected === 'ghs' && styles.radioOn]}>
              <View style={[styles.radioDot, selected === 'ghs' && styles.radioDotOn]} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => setSelected('usdt')}
            style={({ pressed }) => [
              styles.methodRow,
              selected === 'usdt' && styles.methodRowActive,
              pressed && { transform: [{ scale: 0.99 }] },
            ]}>
            <View style={[styles.methodIcon, { backgroundColor: 'rgba(34,197,94,0.10)' }]}>
              <Ionicons name="logo-usd" size={22} color="rgba(34,197,94,0.95)" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>USDT (TRC20)</Text>
              <Text style={styles.methodSub}>{usd.toFixed(2)} USDT</Text>
            </View>
            <View style={[styles.radio, selected === 'usdt' && styles.radioOn]}>
              <View style={[styles.radioDot, selected === 'usdt' && styles.radioDotOn]} />
            </View>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            const params = { usd: String(usd), purpose: 'gas' as const };
            if (selected === 'ngn') router.push({ pathname: '/ngn-payment', params });
            else if (selected === 'ghs') router.push({ pathname: '/ghs-payment', params });
            else router.push({ pathname: '/usdt-payment', params });
          }}
          disabled={!settingsLoaded}
          style={({ pressed }) => [
            styles.cta,
            !settingsLoaded && { opacity: 0.55 },
            pressed && settingsLoaded && { transform: [{ scale: 0.98 }] },
          ]}>
          <Text style={styles.ctaText}>CONTINUE TO PAYMENT</Text>
        </Pressable>
      </ScrollView>
      <PullRefreshSkeletonOverlay visible={refreshing} />
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
  container: { paddingHorizontal: 24, paddingBottom: 40, gap: 18 },
  hero: { alignItems: 'center', marginBottom: 6 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(254,44,85,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { color: '#fff', fontWeight: '900', fontSize: 18, marginBottom: 6 },
  heroSub: { color: vibeColors.muted, fontWeight: '600', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  amountCard: {
    backgroundColor: vibeColors.card,
    borderWidth: 2,
    borderColor: 'rgba(254,44,85,0.40)',
    borderRadius: 40,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    overflow: 'hidden',
  },
  amountGlow: {
    position: 'absolute',
    right: -16,
    top: -16,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(254,44,85,0.10)',
  },
  amountLabel: {
    color: vibeColors.primary,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  amountValue: { color: '#fff', fontWeight: '900', fontSize: 52, letterSpacing: -2, marginBottom: 6 },
  amountLoadingRow: { height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  scannityBar: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  amountHint: { color: vibeColors.muted, fontWeight: '600', fontSize: 10 },
  sectionTitle: {
    paddingHorizontal: 6,
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  methodList: { gap: 12 },
  methodRow: {
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 28,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  methodRowActive: { borderColor: 'rgba(29,161,242,0.40)' },
  methodIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  methodSub: {
    marginTop: 4,
    color: vibeColors.muted,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: vibeColors.secondary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'transparent' },
  radioDotOn: { backgroundColor: vibeColors.secondary },
  cta: {
    height: 60,
    borderRadius: 999,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: vibeColors.primary,
    shadowOpacity: 0.30,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1.4 },
});

