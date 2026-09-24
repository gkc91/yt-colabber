import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Small, Title } from '@/components/Type';
import { space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import { saveNicheAndLanguage, useNiches } from '@/features/onboarding/api';
import { LANGUAGES } from '@/features/onboarding/options';
import { useProfile } from '@/features/profile/api';
import { t } from '@/i18n';

export default function NicheStep() {
  const { session } = useSession();
  const userId = session?.user.id as string;
  const profile = useProfile(userId);
  const niches = useNiches();

  const [nicheId, setNicheId] = useState<number | null>(profile.data?.niche_id ?? null);
  const [language, setLanguage] = useState<string>(profile.data?.language ?? 'en');

  const save = useMutation({
    mutationFn: () => saveNicheAndLanguage(userId, nicheId as number, language),
    onSuccess: () => router.push('/channel'),
  });

  return (
    <Screen gap={space.xxl} style={styles.page}>
      <View style={styles.section}>
        <Title>{t('onboarding.nicheTitle')}</Title>
        <Small tone="muted">{t('onboarding.nicheHint')}</Small>
        {niches.isPending ? (
          <ActivityIndicator />
        ) : (
          <View style={styles.chips} accessibilityRole="radiogroup">
            {niches.data?.map((niche) => (
              <Chip
                key={niche.id}
                label={niche.name}
                selected={niche.id === nicheId}
                onPress={() => setNicheId(niche.id)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Title>{t('onboarding.languageTitle')}</Title>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {LANGUAGES.map((lang) => (
            <Chip
              key={lang.code}
              label={lang.label}
              selected={lang.code === language}
              onPress={() => setLanguage(lang.code)}
            />
          ))}
        </View>
      </View>

      {save.error || niches.error ? <Small tone="accent">{t('auth.genericError')}</Small> : null}
      <Button
        title={t('onboarding.continue')}
        onPress={() => save.mutate()}
        disabled={nicheId === null}
        loading={save.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: space.xxxl,
  },
  section: {
    gap: space.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
