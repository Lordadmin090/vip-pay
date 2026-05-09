import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';

export default function NoScrollScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  return (
    <VibeScreen>
      <View style={[styles.root, { paddingTop: topPad + 24 }]}>
        <View pointerEvents="none" style={styles.blob1} />
        <View pointerEvents="none" style={styles.blob2} />

        <View style={styles.center}>
          <View style={styles.iconStage}>
            <View style={styles.iconCard}>
              <Ionicons name="film" size={48} color="rgba(254,44,85,0.40)" />
            </View>
            <View style={styles.bubble}>
              <Ionicons name="close-circle" size={24} color="#000" />
            </View>
          </View>

          <Text style={styles.title}>Out of Scroll Points!</Text>
          <Text style={styles.sub}>
            Each video consumes 1 SP. Purchase a scroll package to keep earning coins and watching premium content.
          </Text>

          <View style={styles.btnCol}>
            <Pressable
              onPress={() => router.replace('/(tabs)/shop')}
              style={({ pressed }) => [styles.primaryBtn, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Ionicons name="storefront" size={18} color="#fff" />
              <Text style={styles.primaryText}>GET SCROLL POINTS</Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace('/(tabs)/wallet')}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Text style={styles.secondaryText}>BACK TO WALLET</Text>
            </Pressable>
          </View>

          <View style={styles.bonusPill}>
            <Ionicons name="gift" size={16} color={vibeColors.secondary} />
            <Text style={styles.bonusText}>Daily Bonus Available in 4h 12m</Text>
          </View>
        </View>
      </View>
    </VibeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, overflow: 'hidden' },
  blob1: {
    position: 'absolute',
    top: '20%',
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(254,44,85,0.20)',
    opacity: 0.9,
  },
  blob2: {
    position: 'absolute',
    bottom: '20%',
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(29,161,242,0.20)',
    opacity: 0.9,
  },
  center: { alignItems: 'center', maxWidth: 320 },
  iconStage: { marginBottom: 26, position: 'relative' },
  iconCard: {
    width: 112,
    height: 112,
    borderRadius: 40,
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '12deg' }],
  },
  bubble: {
    position: 'absolute',
    top: -14,
    right: -14,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    borderWidth: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontWeight: '900', fontSize: 28, letterSpacing: -0.4, textAlign: 'center', marginBottom: 10 },
  sub: { color: vibeColors.muted, fontWeight: '600', fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 22 },
  btnCol: { width: '100%', gap: 12, marginBottom: 18 },
  primaryBtn: {
    height: 58,
    borderRadius: 999,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: vibeColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  secondaryBtn: {
    height: 58,
    borderRadius: 999,
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  bonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(29,161,242,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(29,161,242,0.20)',
  },
  bonusText: { color: vibeColors.secondary, fontWeight: '900', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
});

