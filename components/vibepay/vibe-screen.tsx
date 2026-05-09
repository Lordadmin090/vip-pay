import { Image } from 'expo-image';
import React, { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

export const vibeColors = {
  background: '#000',
  foreground: '#fff',
  primary: '#FE2C55',
  secondary: '#1DA1F2',
  muted: 'rgba(255,255,255,0.62)',
  card: 'rgba(18,18,18,0.55)',
  border: 'rgba(255,255,255,0.10)',
};

export function VibeScreen({
  backgroundImage,
  children,
}: PropsWithChildren<{
  backgroundImage?: number | { uri: string };
}>) {
  return (
    <View style={styles.root}>
      {backgroundImage ? (
        <>
          <View style={StyleSheet.absoluteFill}>
            <Image source={backgroundImage} style={styles.bgImage} contentFit="cover" />
          </View>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.overlayBase} />
            <View style={styles.overlayTopFade} />
          </View>
        </>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: vibeColors.background,
  },
  bgImage: {
    width: '100%',
    height: '100%',
    opacity: 0.32,
    transform: [{ scale: 1.05 }],
  },
  overlayBase: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  content: {
    flex: 1,
  },
});

