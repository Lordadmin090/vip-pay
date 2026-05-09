import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
  device_os: string;
  device_id: string | null;
};

async function safeImport<T>(fn: () => Promise<T>): Promise<{ mod: T | null; error?: string }> {
  try {
    return { mod: await fn() };
  } catch (e) {
    return { mod: null, error: (e as Error)?.message ?? 'Module not available' };
  }
}

/**
 * Registers an Expo push token for this device/user and stores it in Supabase.
 *
 * Notes:
 * - Requires a **development build** (Expo Go does not support push on Android SDK 53+).
 * - On iOS, you’ll also need APNs configured for production pushes.
 */
export async function registerPushTokenBestEffort(userId: string): Promise<{ ok: boolean; error?: string }> {
  // Avoid importing expo-notifications in Expo Go (Android SDK 53+) because it throws at import time.
  if (Platform.OS === 'android' && (Constants as any)?.appOwnership === 'expo') {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[push] Skipping token registration: Expo Go on Android does not support push tokens.');
    }
    return { ok: false, error: 'Push tokens are not supported in Expo Go. Use a development build.' };
  }

  const { mod: Notifications } = await safeImport(() => import('expo-notifications'));
  if (!Notifications) return { ok: false, error: 'expo-notifications not available.' };

  // Some runtimes (Expo Go Android) don’t expose push token APIs.
  if (typeof (Notifications as any).getExpoPushTokenAsync !== 'function') {
    return { ok: false, error: 'Push tokens not available in this runtime. Use a development build.' };
  }

  const perm = await (Notifications as any).requestPermissionsAsync?.();
  const status = (perm as any)?.status ?? ((perm as any)?.granted ? 'granted' : 'denied');
  if (status !== 'granted') return { ok: false, error: 'Notification permission not granted.' };

  // getExpoPushTokenAsync requires a dev build + configured projectId in many setups.
  let token: string;
  try {
    const t = await (Notifications as any).getExpoPushTokenAsync();
    token = String(t?.data ?? '').trim();
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? 'Failed to get push token.') };
  }
  if (!token) return { ok: false, error: 'Empty push token.' };

  const row: PushTokenRow = {
    user_id: userId,
    expo_push_token: token,
    device_os: Platform.OS,
    device_id: null,
  };

  // Store token (idempotent) so admin actions can target the user.
  const { error } = await supabase.from('push_tokens').upsert(row, { onConflict: 'user_id,expo_push_token' });
  if (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[push] Failed to save push token:', error.message);
    }
    return { ok: false, error: error.message };
  }
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[push] Saved Expo push token for user:', userId);
  }
  return { ok: true };
}

