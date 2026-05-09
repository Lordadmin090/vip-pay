import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOffline } from '@/hooks/use-offline';
import { Offline404 } from '@/components/vibepay/offline-404';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { offline, ready } = useOffline();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {ready && offline ? (
        <Offline404 />
      ) : (
        <Stack initialRouteName="login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="email-verification" options={{ headerShown: false }} />
          <Stack.Screen name="error" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ headerShown: true, presentation: 'modal', title: 'Modal' }} />
        </Stack>
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
