import { Link, Stack } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Body, Title } from '@/components/Type';
import { t } from '@/i18n';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <Screen center>
        <Title>{t('notFound.message')}</Title>
        <Link href="/">
          <Body tone="accent">{t('notFound.home')}</Body>
        </Link>
      </Screen>
    </>
  );
}
