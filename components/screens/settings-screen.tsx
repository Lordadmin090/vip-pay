import React from 'react';
import { PlaceholderScreen } from '@/components/vibepay/placeholder-screen';
import { router } from 'expo-router';
import { requestForegroundLocationPermission } from '@/lib/permissions';

export default function SettingsScreen() {
  return (
    <PlaceholderScreen
      title="Settings"
      backgroundImage={require('@/assets/vibepay/images/Jzzl4zPfwbt.png')}
      sourceHint="`export-react/settings-page.tsx`"
      actions={[
        { label: 'Edit Profile', icon: 'person', onPress: () => router.push('/(tabs)/profile') },
        { label: 'Security & Password', icon: 'shield', onPress: () => {} },
        { label: 'Notifications', icon: 'notifications', onPress: () => router.push('/notification') },
        { label: 'Location (Enable)', icon: 'navigate', onPress: () => void requestForegroundLocationPermission() },
        { label: 'Log out', icon: 'log-out', onPress: () => router.replace('/login') },
      ]}
    />
  );
}

