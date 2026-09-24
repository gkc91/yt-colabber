import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Body } from '@/components/Type';
import { createSessionFromUrl } from '@/features/auth/api';
import { useSession } from '@/features/auth/session';
import { t } from '@/i18n';

// Landing route for magic links and OAuth: clickable://auth?code=… (web: /auth?code=…).
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { session } = useSession();
  const [failed, setFailed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    const source = code ? `clickable://auth?code=${encodeURIComponent(code)}` : url;

    // Bağlantıda işlenecek bir şey yoksa (ör. oturum açıkken /auth'a dönülmüş) ana sayfaya.
    if (!source) {
      if (session) router.replace('/');
      return;
    }
    if (handled.current) return;
    handled.current = true;

    // Oturum açıkken gelen bağlantı BAŞKA bir hesabın olabilir; yine de işleriz,
    // yoksa kullanıcı sessizce eski hesapta kalır.
    createSessionFromUrl(source)
      .then((ok) => {
        if (ok || session) router.replace('/');
        else setFailed(true);
      })
      // Harcanmış bir bağlantı tekrar açıldıysa ve oturum zaten varsa hata gösterme.
      .catch(() => (session ? router.replace('/') : setFailed(true)));
  }, [code, url, session]);

  return (
    <Screen center style={styles.center}>
      {failed ? (
        <>
          <Body>{t('auth.linkFailed')}</Body>
          <Button title={t('auth.backToSignIn')} onPress={() => router.replace('/sign-in')} />
        </>
      ) : (
        <>
          <ActivityIndicator />
          <Body tone="muted">{t('auth.signingIn')}</Body>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
});
