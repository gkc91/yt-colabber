import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Heading, Small, Title } from '@/components/Type';
import { space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import { ChannelFailed, addChannel, channelsQueryKey } from '@/features/channels/api';
import { useNiches, type SubscriberBand } from '@/features/onboarding/api';
import { BANDS, LANGUAGES } from '@/features/onboarding/options';
import { parseChannelUrl } from '@/features/onboarding/channelUrl';
import { t, type MessageKey } from '@/i18n';

/**
 * İkinci (ve sonraki) kanal. Onboarding'deki adımın aynısı değil: orada niş zaten
 * seçilmişti, burada kanalın KENDİ nişi soruluyor — testin hangi havuza gideceğini
 * belirleyen şey o (0020).
 */
export default function AddChannel() {
  const { session } = useSession();
  const userId = session?.user.id as string;
  const queryClient = useQueryClient();
  const niches = useNiches();

  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [nicheId, setNicheId] = useState<number | null>(null);
  const [language, setLanguage] = useState<string>('en');
  const [band, setBand] = useState<SubscriberBand | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  const save = useMutation({
    mutationFn: addChannel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: channelsQueryKey(userId) });
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof ChannelFailed
          ? (`profile.channels.errors.${e.code}` as MessageKey)
          : 'auth.genericError',
      ),
  });

  const onSave = () => {
    const channel = parseChannelUrl(url);
    if (!channel) {
      setUrlError(t('onboarding.channelInvalid'));
      return;
    }
    if (nicheId === null) return;
    setUrlError(null);
    setError(null);
    save.mutate({ channel, band, nicheId, language });
  };

  return (
    <Screen
      gap={space.xxl}
      footer={
        <Button
          title={t('profile.channels.save')}
          onPress={onSave}
          disabled={url.trim().length === 0 || nicheId === null}
          loading={save.isPending}
        />
      }
    >
      <View style={styles.section}>
        <Title>{t('profile.channels.addTitle')}</Title>
        <Small tone="muted">{t('profile.channels.addHint')}</Small>
        <TextField
          label={t('onboarding.channelLabel')}
          placeholder={t('onboarding.channelPlaceholder')}
          value={url}
          onChangeText={setUrl}
          error={urlError}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          inputMode="url"
        />
      </View>

      <View style={styles.section}>
        <Heading>{t('profile.channels.nicheTitle')}</Heading>
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
      </View>

      <View style={styles.section}>
        <Heading>{t('profile.channels.languageTitle')}</Heading>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {LANGUAGES.map((option) => (
            <Chip
              key={option.code}
              label={option.label}
              selected={option.code === language}
              onPress={() => setLanguage(option.code)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Heading>{t('onboarding.bandTitle')}</Heading>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {BANDS.map((option) => (
            <Chip
              key={option.value}
              label={t(option.label)}
              selected={option.value === band}
              onPress={() => setBand(option.value === band ? null : option.value)}
            />
          ))}
        </View>
      </View>

      {error ? <Small tone="accent">{t(error)}</Small> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
