/**
 * React Native port of `export-react/skeleton-loading-page.tsx` — layout and pulse behavior match the web version.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function PulseBox({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

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

  return <Animated.View style={[style, { opacity }]} />;
}

export function SkeletonLoadingPage() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 24);

  return (
    <View style={[styles.root, { paddingBottom: bottomPad + 96 }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <PulseBox style={styles.headerTitleBar} />
        <PulseBox style={styles.headerIconCircle} />
      </View>

      <View style={styles.main}>
        <View style={styles.avatarCol}>
          <PulseBox style={styles.avatarCircle} />
          <PulseBox style={styles.nameBar} />
          <PulseBox style={styles.subBar} />
        </View>

        <PulseBox style={styles.heroBanner} />

        <View style={styles.gridRow}>
          <PulseBox style={styles.gridCard} />
          <PulseBox style={styles.gridCard} />
        </View>

        <View style={styles.listCol}>
          <PulseBox style={styles.listRow} />
          <PulseBox style={styles.listRow} />
          <PulseBox style={styles.listRow} />
        </View>
      </View>

      <View style={[styles.bottomDock, { paddingBottom: bottomPad }]}>
        <PulseBox style={styles.bottomNav} />
      </View>
    </View>
  );
}

const BG = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.05)';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  header: {
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.60)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    ...(Platform.OS === 'ios'
      ? {}
      : {
          elevation: 0,
        }),
  },
  headerTitleBar: {
    width: 128,
    height: 24,
    borderRadius: 999,
    backgroundColor: BG,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG,
  },
  main: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  avatarCol: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: BG,
    marginBottom: 16,
  },
  nameBar: {
    width: 160,
    height: 24,
    borderRadius: 999,
    backgroundColor: BG,
    marginBottom: 8,
  },
  subBar: {
    width: 96,
    height: 12,
    borderRadius: 999,
    backgroundColor: BG,
  },
  heroBanner: {
    width: '100%',
    height: 160,
    borderRadius: 40,
    backgroundColor: BG,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: BORDER,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  gridCard: {
    flex: 1,
    height: 112,
    borderRadius: 32,
    backgroundColor: BG,
  },
  listCol: {
    gap: 16,
  },
  listRow: {
    width: '100%',
    height: 80,
    borderRadius: 24,
    backgroundColor: BG,
  },
  bottomDock: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
    zIndex: 50,
  },
  bottomNav: {
    height: 64,
    borderRadius: 999,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
});
