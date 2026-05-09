import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { useDummyPullRefresh } from '@/hooks/use-dummy-pull-refresh';
import { parseUsdAmount } from '@/lib/fx';

const PRESETS = [10, 25, 50, 100];

export default function FundSPScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const [amount, setAmount] = useState('');
  const { refreshing, onRefresh } = useDummyPullRefresh();
  const usd = parseUsdAmount(amount);

  type PayMethod = 'ngn' | 'ghs' | 'usdt';
  const [method, setMethod] = useState<PayMethod | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetT = useRef(new Animated.Value(0)).current; // 0 closed, 1 open
  const sheetH = 360;

  const openSheet = () => {
    setSheetOpen(true);
    Animated.spring(sheetT, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
  };
  const closeSheet = () => {
    Animated.timing(sheetT, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setSheetOpen(false);
    });
  };

  const methodLabel = useMemo(() => {
    if (method === 'ngn') return 'Bank Transfer (NGN)';
    if (method === 'ghs') return 'Mobile Money (GHS)';
    if (method === 'usdt') return 'USDT (TRC20)';
    return 'Select method';
  }, [method]);

  const methodSub = useMemo(() => {
    if (method === 'ngn') return '₦ rate applied automatically';
    if (method === 'ghs') return 'Momo, Telecel, and more';
    if (method === 'usdt') return '1:1 with USD';
    return 'Tap to choose';
  }, [method]);

  const canProceed = usd > 0 && !!method;

  const proceed = () => {
    if (!canProceed) return;
    const params = { usd: String(usd) };
    if (method === 'ngn') router.push({ pathname: '/ngn-payment', params });
    else if (method === 'ghs') router.push({ pathname: '/ghs-payment', params });
    else router.push({ pathname: '/usdt-payment', params });
  };

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.h1}>Fund Scroll Points</Text>
      </View>

      <ScrollView
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topIntro}>
          <View style={styles.topIconWrap}>
            <Ionicons name="chevron-up" size={22} color={vibeColors.secondary} />
            <Ionicons name="chevron-up" size={22} color={vibeColors.secondary} style={{ marginLeft: -10 }} />
          </View>
          <Text style={styles.topTitle}>Buy Scroll Points</Text>
          <Text style={styles.topSub}>
            Fund your wallet with USD to purchase scroll packages instantly.
          </Text>
        </View>

        <View style={styles.amountCard}>
          <View pointerEvents="none" style={styles.amountGlow} />
          <Text style={styles.amountLabel}>Enter Amount (USD)</Text>
          <View style={styles.amountCenterRow}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.10)"
              style={styles.amountInput}
            />
          </View>
        </View>

        <View style={styles.presetGrid}>
          {PRESETS.map((n) => (
            <Pressable
              key={n}
              onPress={() => setAmount(String(n))}
              style={({ pressed }) => [styles.presetBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
              <Text style={styles.presetText}>${n}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Payment Method</Text>

        <Pressable
          disabled={usd <= 0}
          onPress={openSheet}
          style={({ pressed }) => [
            styles.selectLike,
            usd <= 0 && { opacity: 0.6 },
            pressed && { transform: [{ scale: 0.99 }] },
          ]}>
          <View style={styles.selectLeft}>
            <View style={styles.selectIcon}>
              <Ionicons name="card" size={18} color={vibeColors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectTitle}>{methodLabel}</Text>
              <Text style={styles.selectSub}>{methodSub}</Text>
            </View>
          </View>
          <Ionicons name="chevron-down" size={18} color={vibeColors.muted} />
        </Pressable>

        <Pressable
          disabled={!canProceed}
          onPress={proceed}
          style={({ pressed }) => [
            styles.proceedBtn,
            !canProceed && { opacity: 0.5 },
            pressed && { transform: [{ scale: 0.98 }] },
          ]}>
          <Text style={styles.proceedText}>PROCEED</Text>
        </Pressable>
      </ScrollView>

      {sheetOpen ? (
        <View style={styles.sheetOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.sheet,
              {
                height: sheetH,
                transform: [
                  {
                    translateY: sheetT.interpolate({
                      inputRange: [0, 1],
                      outputRange: [sheetH + 24, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Select payment method</Text>
              <Pressable onPress={closeSheet} style={({ pressed }) => [styles.sheetClose, pressed && { opacity: 0.8 }]}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.sheetList}>
              <Pressable
                onPress={() => {
                  setMethod('ngn');
                  closeSheet();
                }}
                style={({ pressed }) => [styles.sheetItem, pressed && { opacity: 0.92 }]}>
                <Text style={styles.flag}>🇳🇬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemTitle}>Bank Transfer (NGN)</Text>
                  <Text style={styles.sheetItemSub}>₦ rate applied automatically</Text>
                </View>
                {method === 'ngn' ? <Ionicons name="checkmark-circle" size={18} color={vibeColors.secondary} /> : null}
              </Pressable>

              <Pressable
                onPress={() => {
                  setMethod('ghs');
                  closeSheet();
                }}
                style={({ pressed }) => [styles.sheetItem, pressed && { opacity: 0.92 }]}>
                <Text style={styles.flag}>🇬🇭</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemTitle}>Mobile Money (GHS)</Text>
                  <Text style={styles.sheetItemSub}>Momo, Telecel, and more</Text>
                </View>
                {method === 'ghs' ? <Ionicons name="checkmark-circle" size={18} color={vibeColors.secondary} /> : null}
              </Pressable>

              <Pressable
                onPress={() => {
                  setMethod('usdt');
                  closeSheet();
                }}
                style={({ pressed }) => [styles.sheetItem, pressed && { opacity: 0.92 }]}>
                <Ionicons name="logo-usd" size={22} color="#00F2FF" style={{ width: 28, textAlign: 'center' }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemTitle}>USDT (TRC20)</Text>
                  <Text style={styles.sheetItemSub}>1:1 with USD</Text>
                </View>
                {method === 'usdt' ? <Ionicons name="checkmark-circle" size={18} color={vibeColors.secondary} /> : null}
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}

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
  container: { paddingHorizontal: 24, paddingBottom: 40 },

  topIntro: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  topIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(29,161,242,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 14,
  },
  topTitle: { color: '#fff', fontWeight: '900', fontSize: 16, marginBottom: 6 },
  topSub: { color: vibeColors.muted, fontWeight: '600', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  amountCard: {
    backgroundColor: 'rgba(18,18,18,1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 40,
    padding: 22,
    marginBottom: 22,
    alignItems: 'center',
    overflow: 'hidden',
  },
  amountGlow: {
    position: 'absolute',
    top: -32,
    right: -32,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(29,161,242,0.10)',
  },
  amountLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  amountCenterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dollar: { color: vibeColors.secondary, fontWeight: '900', fontSize: 34 },
  amountInput: {
    width: 180,
    height: 62,
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    textAlign: 'left',
    paddingVertical: 0,
  },

  presetGrid: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  presetBtn: {
    flex: 1,
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: { color: '#fff', fontWeight: '900', fontSize: 12 },

  sectionLabel: {
    color: vibeColors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  selectLike: {
    width: '100%',
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 10 },
  selectIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(29,161,242,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(29,161,242,0.18)',
  },
  selectTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  selectSub: { marginTop: 2, color: vibeColors.muted, fontWeight: '700', fontSize: 12 },

  flag: { fontSize: 28 },
  proceedBtn: {
    marginTop: 16,
    height: 56,
    borderRadius: 999,
    backgroundColor: vibeColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1.8 },

  sheetOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 120 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 22,
    backgroundColor: '#0b0b0b',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: 10,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetList: { gap: 10 },
  sheetItem: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetItemTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  sheetItemSub: { marginTop: 2, color: vibeColors.muted, fontWeight: '700', fontSize: 12 },
});

