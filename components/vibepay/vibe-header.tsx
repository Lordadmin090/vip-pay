import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { vibeColors } from './vibe-screen';

export function VibeHeader({ title }: { title: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingTop: 52,
    paddingHorizontal: 24,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: vibeColors.foreground,
    letterSpacing: -0.3,
  },
});

