import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVibeDropAlert } from '@/components/vibepay/drop-alert';
import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { pickReceiptImageFromLibrary, requestReceiptMediaPermissions } from '@/lib/permissions';
import { DEFAULT_APP_SETTINGS, type AppPlatformSettings, fetchAppSettings } from '@/lib/app-settings';
import { parseUsdAmount } from '@/lib/fx';
import { copyToClipboard } from '@/lib/clipboard';
import { useAccountData } from '@/hooks/use-account-data';
import { uploadReceiptAndCreatePurchase } from '@/lib/receipts';

export default function NGNPaymentScreen() {
  const params = useLocalSearchParams<{ usd?: string; purpose?: string }>();
  const usd = parseUsdAmount(params?.usd);
  const purpose = String(params?.purpose ?? 'wallet').toLowerCase();
  const [appSettings, setAppSettings] = useState<AppPlatformSettings>(DEFAULT_APP_SETTINGS);
  const ngn = usd * Number(appSettings.ngn_per_usd);
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const bottomPad = Math.max(insets.bottom, 16);
  const { show: showDrop, Banner: DropBanner } = useVibeDropAlert();
  const { session } = useAccountData();
  const refreshAll = async () => {
    const s = await fetchAppSettings();
    setAppSettings(s);
  };
  const { refreshing, onRefresh } = usePullToRefresh(refreshAll);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const acctNumber = appSettings.ngn_account_number;
  const toastTop = Dimensions.get('window').height - bottomPad - 120;
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
        <Text style={styles.h1}>NGN Payment</Text>
      </View>

      <DropBanner top={toastTop} />

      <ScrollView
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.bigCard}>
          <View pointerEvents="none" style={styles.glow} />
          <View style={styles.amountRow}>
            <Text style={styles.flag}>🇳🇬</Text>
            <View>
              <Text style={styles.amountLabel}>Amount to Pay</Text>
              <Text style={styles.amount}>
                ₦{ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>Bank Name</Text>
            <View style={styles.copyRow}>
              <Text style={styles.copyValue}>{appSettings.ngn_bank_name}</Text>
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>Account Number</Text>
            <View style={styles.copyRow}>
              <Text style={styles.copyValueMono}>{acctNumber}</Text>
              <Pressable
                onPress={async () => {
                  const ok = await copyToClipboard(acctNumber.replace(/\s+/g, ''));
                  if (!ok) return;
                  showDrop('Copied to clipboard', 'success');
                }}
                style={({ pressed }) => [styles.copyPill, pressed && { opacity: 0.85 }]}>
                <Text style={styles.copyPillText}>COPY</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>Account Name</Text>
            <View style={styles.copyRow}>
              <Text style={styles.copyValue}>{appSettings.ngn_account_name}</Text>
            </View>
          </View>
        </View>

        <View style={styles.upload}>
          <Text style={styles.uploadLabel}>Upload Receipt</Text>
          <Pressable
            onPress={async () => {
              const perm = await requestReceiptMediaPermissions();
              if (!perm.ok) return;
              const picked = await pickReceiptImageFromLibrary();
              if (picked.uri) setReceiptUri(picked.uri);
            }}
            style={({ pressed }) => [styles.drop, pressed && { transform: [{ scale: 0.98 }] }]}>
            <View style={styles.upIcon}>
              <Ionicons name="cloud-upload" size={22} color={vibeColors.secondary} />
            </View>
            <Text style={styles.dropText}>{receiptUri ? 'Receipt selected' : 'Tap to upload screenshot'}</Text>
          </Pressable>

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
                paymentMethod: 'ngn',
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
    gap: 18,
  },
  bigCard: {
    borderRadius: 40,
    padding: 20,
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    gap: 14,
  },
  glow: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(29,161,242,0.20)',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  flag: { fontSize: 34 },
  amountLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  amount: { color: '#fff', fontSize: 22, fontWeight: '900' },
  group: { gap: 8 },
  groupLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  copyRow: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  copyValue: { color: '#fff', fontWeight: '900', fontSize: 14, flex: 1 },
  copyValueMono: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1.2, flex: 1 },
  copyPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyPillText: { color: vibeColors.secondary, fontWeight: '900', fontSize: 10, letterSpacing: 1.2 },
  upload: { gap: 12 },
  uploadLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  drop: {
    height: 140,
    borderRadius: 32,
    backgroundColor: 'rgba(18,18,18,0.20)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  upIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(29,161,242,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropText: { color: vibeColors.muted, fontSize: 12, fontWeight: '800' },
  cta: {
    height: 64,
    borderRadius: 999,
    backgroundColor: vibeColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: vibeColors.secondary,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
});

