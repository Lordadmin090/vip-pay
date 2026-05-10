import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SkeletonLoadingPage } from '@/components/vibepay/skeleton-loading-page';

/** Route matches export-react skeleton loading screen — same layout as `SkeletonLoadingPage`. */
export default function SkeletonLoadingScreen() {
  return (
    <View style={styles.root}>
      <SkeletonLoadingPage />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});
