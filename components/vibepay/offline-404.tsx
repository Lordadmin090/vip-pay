import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { vibeColors } from '@/components/vibepay/vibe-screen';

export function Offline404() {
  return (
    <View style={styles.root}>
      <View style={styles.glowWrap} pointerEvents="none">
        <View style={styles.glowPrimary} />
        <View style={styles.glowSecondary} />
      </View>

      <View style={styles.content}>
        <View style={styles.artWrap}>
          <Image source={require('@/assets/vibepay/images/8BTJpFPEM8C.png')} style={styles.art} contentFit="contain" />
          <Ionicons name="skull" size={120} color="rgba(254,44,85,0.10)" style={styles.ghost} />
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.big}>404</Text>
          <Text style={styles.h2}>LOST IN SPACE</Text>
          <Text style={styles.p}>The page you&apos;re looking for has vanished into the digital void.</Text>
        </View>

        <Pressable
          onPress={() => router.replace('/(tabs)/wallet')}
          style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.98 }] }]}>
          <Ionicons name="home" size={20} color="#141414" />
          <Text style={styles.btnText}>BACK TO HOME</Text>
        </Pressable>
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
    paddingHorizontal: 28,
  },
  glowWrap: { ...StyleSheet.absoluteFillObject },
  glowPrimary: {
    position: 'absolute',
    top: '22%',
    left: '50%',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(254,44,85,0.20)',
    transform: [{ translateX: -190 }],
    opacity: 1,
  },
  glowSecondary: {
    position: 'absolute',
    bottom: '22%',
    left: '50%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(29,161,242,0.12)',
    transform: [{ translateX: -150 }],
  },
  content: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 18 },
  artWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  art: { width: 180, height: 180 },
  ghost: { position: 'absolute' },
  textBlock: { alignItems: 'center', gap: 6 },
  big: { fontSize: 64, fontWeight: '900', color: '#fff', letterSpacing: -1.2 },
  h2: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  p: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: vibeColors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  btn: {
    marginTop: 8,
    height: 60,
    borderRadius: 999,
    width: '100%',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#fff',
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  btnText: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: '#000' },
});

