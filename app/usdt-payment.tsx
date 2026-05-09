import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { pickReceiptImageFromLibrary, requestReceiptMediaPermissions } from '@/lib/permissions';
import { parseUsdAmount } from '@/lib/fx';
import { DEFAULT_APP_SETTINGS, type AppPlatformSettings, fetchAppSettings } from '@/lib/app-settings';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useAccountData } from '@/hooks/use-account-data';
import { uploadReceiptAndCreatePurchase } from '@/lib/receipts';
import { useVibeDropAlert } from '@/components/vibepay/drop-alert';

export default function USDTPaymentScreen() {
  const params = useLocalSearchParams<{ usd?: string; purpose?: string }>();
  const usd = parseUsdAmount(params?.usd);
  const purpose = String(params?.purpose ?? 'wallet').toLowerCase();
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppPlatformSettings>(DEFAULT_APP_SETTINGS);
  const { session } = useAccountData();
  const { show: showDrop, Banner: DropBanner } = useVibeDropAlert();
  const refreshAll = async () => {
    const s = await fetchAppSettings();
    setAppSettings(s);
  };
  const { refreshing, onRefresh } = usePullToRefresh(refreshAll);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.h1}>USDT Payment</Text>
      </View>

      <DropBanner top={topPad + 66} />

      <ScrollView
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.qrCard}>
          <Text style={styles.qrLabel}>Scan QR Code</Text>
          <View style={styles.qrBox}>
            <Image source={require('@/assets/vibepay/images/square.png')} style={styles.qrImg} contentFit="contain" />
          </View>

          <View style={styles.addr}>
            <Text style={styles.addrLabel}>USDT Wallet Address (TRC20)</Text>
            <View style={styles.addrRow}>
              <Text style={styles.addrValue} numberOfLines={2}>
                {appSettings.usdt_wallet_address}
              </Text>
              <Ionicons name="copy" size={18} color={vibeColors.secondary} />
            </View>
          </View>

          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Network</Text>
            <Text style={styles.netPill}>TRC20</Text>
          </View>
        </View>

        <View style={styles.proofCard}>
          <View style={styles.proofRow}>
            <Text style={styles.proofLeft}>Expected Amount</Text>
            <Text style={styles.proofRight}>{usd.toFixed(2)} USDT</Text>
          </View>
          <View style={styles.hr} />
          <Text style={styles.proofLabel}>Upload Receipt</Text>

          <Pressable
            onPress={async () => {
              const perm = await requestReceiptMediaPermissions();
              if (!perm.ok) return;
              const picked = await pickReceiptImageFromLibrary();
              if (picked.uri) setReceiptUri(picked.uri);
            }}
            style={({ pressed }) => [styles.smallDrop, pressed && { transform: [{ scale: 0.98 }] }]}>
            <Ionicons name="cloud-upload" size={18} color={vibeColors.muted} />
            <Text style={styles.smallDropText}>{receiptUri ? 'Receipt selected' : 'Upload Screenshot'}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={async () => {
            const uid = session?.user?.id;
            if (!uid) {
              showDrop('Please sign in.', 'warning');
              return;
            }
            if (!receiptUri) {
              showDrop('Upload a receipt first.', 'warning');
              return;
            }
            if (submitting) return;
            setSubmitting(true);
            const r = await uploadReceiptAndCreatePurchase({
              userId: uid,
              amountUsd: usd,
              paymentMethod: 'usdt',
              purchaseType: purpose === 'gas' ? 'gas_fee_topup' : 'deposit_wallet',
              localUri: receiptUri,
            });
            setSubmitting(false);
            if (!r.ok) {
              showDrop(r.error ?? 'Upload failed', 'warning');
              return;
            }
            if (!r.purchaseId) {
              showDrop('Submitted, but could not open receipt details.', 'warning');
              return;
            }
            router.replace({ pathname: '/transaction-details', params: { kind: 'purchase', id: r.purchaseId } });
          }}
          style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.98 }] }]}>
          <Text style={styles.ctaText}>SUBMIT PAYMENT</Text>
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
  qrCard: {
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
  },
  qrLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  qrBox: {
    width: 192,
    height: 192,
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 14,
  },
  qrImg: { width: '100%', height: '100%' },
  addr: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  addrLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  addrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  addrValue: { color: '#fff', fontSize: 12, fontWeight: '800', flex: 1 },
  netRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  netPill: {
    color: 'rgba(34,197,94,0.95)',
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  proofCard: {
    backgroundColor: 'rgba(18,18,18,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  proofRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proofLeft: { color: vibeColors.muted, fontSize: 12, fontWeight: '600' },
  proofRight: { color: '#fff', fontSize: 12, fontWeight: '900' },
  hr: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  proofLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  input: {
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14,
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  smallDrop: {
    height: 88,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  smallDropText: { color: vibeColors.muted, fontSize: 12, fontWeight: '800' },
  cta: {
    height: 58,
    borderRadius: 999,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
});

