import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

export type SwipeUpOnboardingHintProps = {
  /** When true, loops the swipe-up gesture hint until hidden. */
  visible: boolean;
  /** Distance from safe-area bottom (points). */
  bottomOffset?: number;
  /** Horizontal scale factor for the arrow graphic (base ~112pt wide). */
  sizeScale?: number;
  /** Peak opacity at rest before each upward glide (0–1). */
  peakOpacity?: number;
  /** Total loop duration target ~1500–2000ms (glide + pause). */
  glideMs?: number;
  pauseMs?: number;
  /** Stroke color (outline). */
  strokeColor?: string;
  /** Outer glow stroke (wider, fainter) for premium soft bloom. */
  glowColor?: string;
};

/**
 * Bottom-centered “swipe up” cue: three stacked chevrons glide upward together, fade out, repeat.
 * pointerEvents none — does not block touches.
 */
export function SwipeUpOnboardingHint({
  visible,
  bottomOffset = 100,
  sizeScale = 1,
  peakOpacity = 0.58,
  glideMs = 880,
  pauseMs = 620,
  strokeColor = 'rgba(255,255,255,0.98)',
  glowColor = 'rgba(255,255,255,0.32)',
}: SwipeUpOnboardingHintProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  /** Vertical spacing between the three chevrons (px before scale). */
  const stackStep = 22;
  const travelPx = useMemo(() => Math.round(58 * sizeScale), [sizeScale]);

  useEffect(() => {
    loopRef.current?.stop();
    loopRef.current = null;

    if (!visible) {
      translateY.stopAnimation();
      opacity.stopAnimation();
      translateY.setValue(0);
      opacity.setValue(0);
      return;
    }

    const easeOutCubic = Easing.out(Easing.cubic);

    const cycle = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: peakOpacity,
          duration: Math.min(220, glideMs / 4),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -travelPx,
          duration: glideMs,
          easing: easeOutCubic,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: glideMs,
          easing: easeOutCubic,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(pauseMs),
    ]);

    loopRef.current = Animated.loop(cycle);
    loopRef.current.start();

    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
      translateY.stopAnimation();
      opacity.stopAnimation();
    };
  }, [visible, glideMs, pauseMs, peakOpacity, opacity, translateY, travelPx]);

  const w = 120 * sizeScale;
  /** One chevron tip ~y=20, base ~y=56; stackStep * 2 shifts the third row. */
  const viewH = 56 + stackStep * 2 + 8;
  const h = viewH * sizeScale;

  /** Shared upward chevron path (outline Λ). */
  const chevronD = 'M22 56 L60 18 L98 56';

  const stackOffsets = useMemo(() => [0, stackStep, stackStep * 2], [stackStep]);

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[styles.wrap, { bottom: bottomOffset }]}
      pointerEvents="none"
      accessibilityRole="image"
      accessibilityLabel="Swipe up for the next video"
      importantForAccessibility="no">
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }],
          alignItems: 'center',
          justifyContent: 'flex-end',
          shadowColor: '#fff',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.65,
          shadowRadius: 18,
          elevation: 0,
        }}>
        <Svg width={w} height={h} viewBox={`0 0 120 ${viewH}`}>
          {stackOffsets.map((dy, i) => (
            <G key={i} transform={`translate(0, ${dy})`}>
              {/* Outer bloom — bold halo per row */}
              <Path
                d={chevronD}
                fill="none"
                stroke={glowColor}
                strokeWidth={16}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Path
                d={chevronD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={6}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </G>
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
});
