import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Text, View } from '@/components/Themed';
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>{t('onboarding.nicheTitle')}</Text>
        <Text style={styles.hint}>{t('onboarding.nicheHint')}</Text>
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
        <Text style={styles.title}>{t('onboarding.languageTitle')}</Text>
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

      {save.error || niches.error ? (
        <Text style={styles.error}>{t('auth.genericError')}</Text>
      ) : null}
      <Button
        title={t('onboarding.continue')}
        onPress={() => save.mutate()}
        disabled={nicheId === null}
        loading={save.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 64,
    gap: 32,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  section: {
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  hint: {
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  error: {
    color: '#c62828',
  },
});
