import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type PermissionResult = { ok: boolean; status?: string; error?: string };

async function safeImport<T>(fn: () => Promise<T>): Promise<{ mod: T | null; error?: string }> {
  try {
    return { mod: await fn() };
  } catch (e) {
    return { mod: null, error: (e as Error)?.message ?? 'Module not available' };
  }
}

export async function requestReceiptMediaPermissions(): Promise<PermissionResult> {
  const { mod, error } = await safeImport(() => import('expo-image-picker'));
  if (!mod) return { ok: false, error: `Missing dependency expo-image-picker. ${error ?? ''}`.trim() };

  const ImagePicker = mod as typeof import('expo-image-picker');

  // Android 13+ uses READ_MEDIA_IMAGES; Expo handles mapping.
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (lib.status !== 'granted') return { ok: false, status: lib.status };

  // Optional camera permission for "take photo" style uploads later.
  if (Platform.OS !== 'web') {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== 'granted') {
      // still ok if user only wants gallery upload
      return { ok: true, status: lib.status };
    }
  }

  return { ok: true, status: lib.status };
}

export async function pickReceiptImageFromLibrary(): Promise<{ uri: string | null; error?: string }> {
  const { mod, error } = await safeImport(() => import('expo-image-picker'));
  if (!mod) return { uri: null, error: `Missing dependency expo-image-picker. ${error ?? ''}`.trim() };
  const ImagePicker = mod as typeof import('expo-image-picker');

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  if (res.canceled) return { uri: null };
  return { uri: res.assets?.[0]?.uri ?? null };
}

export async function requestForegroundLocationPermission(): Promise<PermissionResult> {
  const { mod, error } = await safeImport(() => import('expo-location'));
  if (!mod) return { ok: false, error: `Missing dependency expo-location. ${error ?? ''}`.trim() };
  const Location = mod as typeof import('expo-location');

  const r = await Location.requestForegroundPermissionsAsync();
  return { ok: r.status === 'granted', status: r.status };
}

export async function requestNotificationsPermission(): Promise<PermissionResult> {
  // Avoid importing expo-notifications in Expo Go (Android SDK 53+) because it throws at import time.
  if (Platform.OS === 'android' && (Constants as any)?.appOwnership === 'expo') {
    return {
      ok: false,
      status: 'unavailable',
      error: 'Push notifications are not supported in Expo Go. Use a development build to enable phone notification bar alerts.',
    };
  }

  const { mod, error } = await safeImport(() => import('expo-notifications'));
  if (!mod) return { ok: false, error: `Missing dependency expo-notifications. ${error ?? ''}`.trim() };
  const Notifications = mod as typeof import('expo-notifications');

  // Expo Go (SDK 53+) does not support remote push notifications on Android and may not expose
  // requestPermissionsAsync; avoid crashing and just return a friendly "unsupported".
  if (typeof (Notifications as any)?.requestPermissionsAsync !== 'function') {
    return { ok: false, status: 'unavailable', error: 'Notifications permission request is not available in Expo Go. Use a development build.' };
  }

  const r = await (Notifications as any).requestPermissionsAsync();
  // iOS returns { granted: boolean }, Android returns status-like; normalize through status/granted.
  const status = (r as any)?.status ?? ((r as any)?.granted ? 'granted' : 'denied');
  return { ok: status === 'granted', status };
}

