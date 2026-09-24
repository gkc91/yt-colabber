import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import { Archivo_600SemiBold, Archivo_700Bold, useFonts } from '@expo-google-fonts/archivo';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { headerTitleStyle, navigationTheme } from '@/design/navigationTheme';
import { SessionProvider, useSession } from '@/features/auth/session';
import { registerDevice } from '@/features/device/api';
import { useProfile } from '@/features/profile/api';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={navigationTheme[colorScheme]}>
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useSession();
  // Başlık fontu (DESIGN.md §4). Yüklenene kadar ekran açılmaz: yazı kayması olmasın.
  const [fontsLoaded] = useFonts({ Archivo_600SemiBold, Archivo_700Bold });
  const userId = session?.user.id;
  const profile = useProfile(userId);

  // Profil okunamıyorsa (oturum süresi dolmuş, kullanıcı silinmiş) boş ekranda kalmak yerine
  // oturumu kapatıp giriş ekranına döneriz.
  const profileFailed = profile.isError;
  const ready = fontsLoaded && !isLoading && (!userId || !profile.isPending || profileFailed);
  const onboarded = profile.data?.onboarding_done === true;

  useEffect(() => {
    // Doğrudan supabase: features/auth/api web'de tarayıcı oturumu kütüphanelerini çekiyor.
    if (profileFailed) supabase.auth.signOut().catch(() => {});
  }, [profileFailed]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Once per signed-in user per app start; the server dedupes and applies the account limit.
  useEffect(() => {
    if (userId) registerDevice().catch(() => {});
  }, [userId]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !onboarded}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && onboarded}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      {/* Magic link / OAuth return; must stay reachable before a session exists. */}
      <Stack.Screen name="auth" />
      <Stack.Screen
        name="paywall"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: t('paywall.headerTitle'),
          headerTitleStyle,
        }}
      />
      <Stack.Screen name="index" />
    </Stack>
  );
}
