import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { vibeColors } from '@/components/vibepay/vibe-screen';

export default function ErrorScreen() {
  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.bgRadial} />

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <View style={styles.iconCard}>
            <Ionicons name="shield" size={46} color={vibeColors.primary} />
          </View>
          <View style={styles.iconBadge}>
            <Ionicons name="close-circle" size={20} color="#fff" />
          </View>
        </View>

        <Text style={styles.h2}>Something went wrong</Text>
        <Text style={styles.p}>
          We encountered an unexpected error while processing your request. Please check your internet connection and try
          again.
        </Text>

        <View style={styles.btnStack}>
          <Pressable
            onPress={() => router.replace('/(tabs)/wallet')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { transform: [{ scale: 0.98 }] }]}>
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.secondaryText}>CONTACT SUPPORT</Text>
          </Pressable>
        </View>

        <View style={styles.codeRow}>
          <Ionicons name="bug" size={12} color="rgba(255,255,255,0.35)" />
          <Text style={styles.codeText}>Error Code: ERR_CON_REFUSED</Text>
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
  bgRadial: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(254,44,85,0.06)',
    opacity: 0.5,
  },
  content: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 18,
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCard: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  iconBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: vibeColors.primary,
    borderWidth: 4,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  h2: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: -0.3,
    marginBottom: 10,
    textAlign: 'center',
  },
  p: {
    color: vibeColors.muted,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 22,
  },
  btnStack: { width: '100%', gap: 12 },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 999,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  primaryText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1.6 },
  secondaryBtn: { width: '100%', height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: vibeColors.muted, fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },
  codeRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: 0.35 },
  codeText: { color: '#fff', fontWeight: '900', fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
});

