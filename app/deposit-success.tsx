import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { parseUsdAmount } from '@/lib/fx';

export default function DepositSuccessScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const params = useLocalSearchParams<{ usd?: string; method?: string }>();
  const usd = parseUsdAmount(params?.usd);
  const method = String(params?.method ?? '').toUpperCase() || 'PAYMENT';

  const subtitle = useMemo(() => {
    return `${method} deposit submitted. Your wallet will be credited after admin verification.`;
  }, [method]);

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/history?tab=purchases');
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <VibeScreen>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: topPad + 18 }]}>
          <Pressable onPress={() => router.replace('/history?tab=purchases')} style={styles.close}>
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={44} color={vibeColors.secondary} />
          </View>
          <Text style={styles.title}>Submitted</Text>
          <Text style={styles.amount}>${usd.toFixed(2)}</Text>
          <Text style={styles.sub}>{subtitle}</Text>

          <Pressable onPress={() => router.replace('/history?tab=purchases')} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.btnText}>VIEW DEPOSITS</Text>
          </Pressable>
        </View>
      </View>
    </VibeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  header: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'flex-end' },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(18,18,18,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(29,161,242,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(29,161,242,0.18)',
  },
  title: { color: '#fff', fontWeight: '900', fontSize: 18, marginTop: 8 },
  amount: { color: vibeColors.secondary, fontWeight: '900', fontSize: 28, letterSpacing: -0.5 },
  sub: { color: vibeColors.muted, fontWeight: '700', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 6 },
  btn: {
    marginTop: 14,
    height: 56,
    width: '100%',
    borderRadius: 999,
    backgroundColor: vibeColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1.8 },
});

