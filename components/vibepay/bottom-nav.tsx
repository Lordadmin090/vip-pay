import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { vibeColors } from './vibe-screen';

type TabKey = 'shop' | 'history' | 'watch' | 'wallet' | 'profile';

export function VibeBottomNav() {
  const pathname = usePathname();
  const active = useMemo<TabKey>(() => {
    // Normalize so nested routes still highlight correct tab
    const p = pathname.replace(/\/+$/, '');
    // Expo Router pathnames can be either '/shop' or '/(tabs)/shop' depending on context/build.
    if (p === '/shop' || p.startsWith('/shop/') || p.includes('/(tabs)/shop')) return 'shop';
    if (p === '/history' || p.startsWith('/history/') || p.includes('/(tabs)/history')) return 'history';
    if (p === '/wallet' || p.startsWith('/wallet/') || p.includes('/(tabs)/wallet')) return 'wallet';
    if (p === '/profile' || p.startsWith('/profile/') || p.includes('/(tabs)/profile')) return 'profile';
    return 'watch';
  }, [pathname]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.nav}>
        <NavItem
          label="Shop"
          active={active === 'shop'}
          activeColor={vibeColors.primary}
          onPress={() => router.replace('/(tabs)/shop')}>
          <Ionicons
            name={active === 'shop' ? 'cart' : 'cart-outline'}
            size={24}
            color={active === 'shop' ? vibeColors.primary : vibeColors.muted}
          />
        </NavItem>
        <NavItem
          label="History"
          active={active === 'history'}
          activeColor={vibeColors.primary}
          onPress={() => router.replace('/(tabs)/history')}>
          <Ionicons
            name={active === 'history' ? 'time' : 'time-outline'}
            size={24}
            color={active === 'history' ? vibeColors.primary : vibeColors.muted}
          />
        </NavItem>

        <Pressable
          onPress={() => router.replace('/(tabs)/watch')}
          style={({ pressed }) => [styles.centerItem, pressed && { transform: [{ scale: 0.95 }] }]}>
          <View style={[styles.centerBtn, active === 'watch' ? styles.centerBtnActive : styles.centerBtnInactive]}>
            <Ionicons
              name="play"
              size={30}
              color={active === 'watch' ? '#fff' : vibeColors.primary}
              style={{ marginLeft: 2 }}
            />
          </View>
          <Text style={[styles.centerLabel, active === 'watch' && styles.centerLabelActive]}>Watch</Text>
        </Pressable>

        <NavItem
          label="Wallet"
          active={active === 'wallet'}
          activeColor={vibeColors.primary}
          onPress={() => router.replace('/(tabs)/wallet')}>
          <Ionicons
            name={active === 'wallet' ? 'wallet' : 'wallet-outline'}
            size={24}
            color={active === 'wallet' ? vibeColors.primary : vibeColors.muted}
          />
        </NavItem>
        <NavItem
          label="Profile"
          active={active === 'profile'}
          activeColor={vibeColors.primary}
          onPress={() => router.replace('/(tabs)/profile')}>
          <Ionicons
            name={active === 'profile' ? 'person-circle' : 'person-circle-outline'}
            size={24}
            color={active === 'profile' ? vibeColors.primary : vibeColors.muted}
          />
        </NavItem>
      </View>
    </View>
  );
}

function NavItem({
  label,
  active,
  activeColor,
  onPress,
  children,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { opacity: 0.9 }]}>
      {children}
      <Text
        style={[
          styles.label,
          active ? styles.labelActive : styles.labelInactive,
          active ? { color: activeColor } : null,
        ]}>
        {label}
      </Text>
      <View
        style={[
          styles.indicator,
          // Pink indicator moves to active tab (like Watch)
          active ? { backgroundColor: vibeColors.primary, opacity: 1 } : { opacity: 0 },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    zIndex: 50,
  },
  nav: {
    backgroundColor: 'rgba(0,0,0,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  label: {
    fontSize: 10,
  },
  labelInactive: {
    color: vibeColors.muted,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  indicator: {
    marginTop: 4,
    width: 14,
    height: 3,
    borderRadius: 999,
  },
  centerItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    gap: 6,
  },
  centerBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 1,
    shadowColor: vibeColors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  centerBtnActive: {
    backgroundColor: vibeColors.primary,
  },
  centerBtnInactive: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(0,0,0,0.90)',
    shadowOpacity: 0.15,
  },
  centerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: vibeColors.muted,
  },
  centerLabelActive: {
    color: vibeColors.primary,
    fontWeight: '900',
  },
});

