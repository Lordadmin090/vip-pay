import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export type DropAlertVariant = 'success' | 'warning';

function DropAlertInner({
  banner,
  translateY,
  top,
}: {
  banner: { text: string; variant: DropAlertVariant };
  translateY: Animated.Value;
  top: number;
}) {
  const pillStyle =
    banner.variant === 'success' ? styles.pillSuccess : styles.pillWarning;
  // Match shop: checkmark = success, alert circle = issue (here on amber, not pink)
  const iconName =
    banner.variant === 'success' ? ('checkmark-circle' as const) : ('alert-circle' as const);

  return (
    <Animated.View
      style={[styles.wrap, { top, transform: [{ translateY }] }]}
      pointerEvents="none">
      <View style={[styles.pill, pillStyle]}>
        <Ionicons name={iconName} size={16} color="#fff" />
        <Text style={styles.pillText} numberOfLines={4}>
          {banner.text}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * Same slide-down toast behavior as Shop (`shop.tsx`): spring in, pause, slide up.
 * Colors: green = success, amber = warning (no pink/red pill).
 */
export function useVibeDropAlert() {
  const [banner, setBanner] = useState<{ text: string; variant: DropAlertVariant } | null>(null);
  const translateY = useRef(new Animated.Value(-90)).current;

  const show = useCallback(
    (text: string, variant: DropAlertVariant = 'warning') => {
      setBanner({ text, variant });
      translateY.stopAnimation();
      translateY.setValue(-90);
      Animated.sequence([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 220,
        }),
        Animated.delay(2200),
        Animated.timing(translateY, {
          toValue: -90,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setBanner(null);
      });
    },
    [translateY]
  );

  const Banner = useMemo(() => {
    function B({ top }: { top: number }) {
      if (!banner) return null;
      return <DropAlertInner banner={banner} translateY={translateY} top={top} />;
    }
    return B;
  }, [banner, translateY]);

  return { show, Banner };
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 200,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pillSuccess: {
    backgroundColor: 'rgba(34,197,94,0.92)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillWarning: {
    backgroundColor: 'rgba(234,179,8,0.92)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  pillText: {
    flexShrink: 1,
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
});
