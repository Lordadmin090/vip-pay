import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDummyPullRefresh } from '@/hooks/use-dummy-pull-refresh';
import { parseUsdAmount } from '@/lib/fx';

export default function PaymentMethodSelectionScreen() {
  const params = useLocalSearchParams<{ usd?: string }>();
  const usd = parseUsdAmount(params?.usd);
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const { refreshing, onRefresh } = useDummyPullRefresh();

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.h1}>Select Payment</Text>
      </View>

      <ScrollView
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>Choose your preferred method to complete the transaction.</Text>

        <View style={styles.list}>
          <Pressable
            onPress={() => router.push({ pathname: '/ngn-payment', params: { usd: String(usd) } })}
            style={({ pressed }) => [styles.item, pressed && { transform: [{ scale: 0.98 }] }]}>
            <View style={[styles.flagWrap, { backgroundColor: 'rgba(254,44,85,0.10)' }]}>
              <Text style={styles.flag}>🇳🇬</Text>
            </View>
            <View style={styles.itemMid}>
              <Text style={styles.itemTitle}>Bank Transfer (NGN)</Text>
              <Text style={styles.itemSub}>Instant verification in Nigeria</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={vibeColors.muted} />
          </Pressable>

          <Pressable
            onPress={() => router.push({ pathname: '/ghs-payment', params: { usd: String(usd) } })}
            style={({ pressed }) => [styles.item, pressed && { transform: [{ scale: 0.98 }] }]}>
            <View style={[styles.flagWrap, { backgroundColor: 'rgba(29,161,242,0.10)' }]}>
              <Text style={styles.flag}>🇬🇭</Text>
            </View>
            <View style={styles.itemMid}>
              <Text style={styles.itemTitle}>Mobile Money (GHS)</Text>
              <Text style={styles.itemSub}>Momo, Telecel, and more</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={vibeColors.muted} />
          </Pressable>

          <Pressable
            onPress={() => router.push({ pathname: '/usdt-payment', params: { usd: String(usd) } })}
            style={({ pressed }) => [styles.item, pressed && { transform: [{ scale: 0.98 }] }]}>
            <View style={[styles.flagWrap, { backgroundColor: 'rgba(0,242,255,0.14)' }]}>
              <Ionicons name="logo-usd" size={22} color="#00F2FF" />
            </View>
            <View style={styles.itemMid}>
              <Text style={styles.itemTitle}>USDT (TRC20)</Text>
              <Text style={styles.itemSub}>Global crypto payments</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={vibeColors.muted} />
          </Pressable>
        </View>
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
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  lead: {
    color: vibeColors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  list: { gap: 12 },
  item: {
    padding: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  flagWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 28 },
  itemMid: { flex: 1 },
  itemTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  itemSub: { marginTop: 4, color: vibeColors.muted, fontWeight: '600', fontSize: 12 },
});

