import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type PushPermission = 'granted' | 'denied' | 'unsupported';

/** Web'de push yok (PRODUCT §14: web değerlendirme ve sonuç içindir). */
export const pushSupported = Platform.OS !== 'web';

export async function getPushPermission(): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/**
 * İzin ister, Expo push token'ı alır ve profile yazar. Token sunucuda tutulur:
 * bildirimleri kuyruktan Edge Function gönderir (0011).
 */
export async function enablePushNotifications(userId: string): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';

  const existing = await Notifications.getPermissionsAsync();
  const decision = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!decision.granted) return 'denied';

  if (Platform.OS === 'android') {
    // Android 13+ kanal tanımlı değilse bildirimi göstermez.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token.data })
    .eq('id', userId);
  if (error) throw error;

  return 'granted';
}

/** Kullanıcı bildirimleri kapatırsa token temizlenir; sunucu boşuna denemesin. */
export async function disablePushNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: null })
    .eq('id', userId);
  if (error) throw error;
}
