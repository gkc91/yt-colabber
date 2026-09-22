import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const WEB_DEVICE_KEY = 'firstcut.device_id';

async function getDeviceId(): Promise<string | null> {
  if (Platform.OS === 'android') return Application.getAndroidId();
  if (Platform.OS === 'ios') return Application.getIosIdForVendorAsync();

  // Web has no stable hardware id; a stored random id is the best available signal.
  let id = await AsyncStorage.getItem(WEB_DEVICE_KEY);
  if (!id) {
    id = `web-${Crypto.randomUUID()}`;
    await AsyncStorage.setItem(WEB_DEVICE_KEY, id);
  }
  return id;
}

// The multi-account limit lives in Postgres (register_device); the client only reports its id.
export async function registerDevice() {
  const deviceId = await getDeviceId();
  if (!deviceId) return;
  const { error } = await supabase.rpc('register_device', { p_device_id: deviceId });
  if (error) throw error;
}
