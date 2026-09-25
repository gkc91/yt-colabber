import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type PushPermission = 'granted' | 'denied' | 'unsupported';

/**
 * Bildirimlerin gerçekten açık olması iki şart: işletim sistemi izni VE sunucuda kayıtlı
 * bir token. İkincisi olmadan kuyruk kimseye ulaşmaz. Ekran yalnızca izne bakarsa
 * "haber veririz" yazar ama hiçbir şey gelmez — bir süre öyle oldu.
 */
export async function pushStatus(userId: string): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return 'denied';

  const { data, error } = await supabase
    .from('profiles')
    .select('expo_push_token')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data.expo_push_token ? 'granted' : 'denied';
}

/**
 * Token alınamazsa fırlatır. Çağıran bunu "kullanıcı reddetti" ile karıştırmamalı:
 * Android'de token almak Firebase yapılandırması ister (google-services.json + EAS'te
 * FCM V1 anahtarı); eksikse izin verilmiş olsa bile burası patlar.
 */
export class PushUnavailable extends Error {
  constructor(readonly cause: unknown) {
    super('push_unavailable');
    this.name = 'PushUnavailable';
  }
}

/** Web'de push yok (PRODUCT §14: web değerlendirme ve sonuç içindir). */
export const pushSupported = Platform.OS !== 'web';

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
  let token: Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;
  try {
    token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  } catch (error) {
    throw new PushUnavailable(error);
  }

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
