import React from 'react';
import { Platform, RefreshControl, StyleSheet, View } from 'react-native';

import { SkeletonLoadingPage } from '@/components/vibepay/skeleton-loading-page';

/** iOS/Android: hide default spinner so the skeleton overlay is what users see. */
export function hiddenRefreshControl(refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="transparent"
      title=""
      titleColor="transparent"
      colors={Platform.OS === 'android' ? ['transparent'] : undefined}
      progressBackgroundColor={Platform.OS === 'android' ? 'transparent' : undefined}
    />
  );
}

/** Full-screen skeleton while refreshing or initial load; blocks touches over content. */
export function PullRefreshSkeletonOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <SkeletonLoadingPage />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    backgroundColor: '#000',
  },
});
