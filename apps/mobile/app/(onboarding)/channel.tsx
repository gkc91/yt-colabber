import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Heading, Small, Title } from '@/components/Type';
import { TextField } from '@/components/TextField';
import { space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import { completeOnboarding, type SubscriberBand } from '@/features/onboarding/api';
import { BANDS } from '@/features/onboarding/options';
import { parseYouTubeChannelUrl, type YouTubeChannelRef } from '@/features/onboarding/youtube';
import { profileQueryKey } from '@/features/profile/api';
import { track } from '@/lib/track';
import { t } from '@/i18n';

export default function ChannelStep() {
  const { session } = useSession();
  const userId = session?.user.id as string;
  const queryClient = useQueryClient();

  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [band, setBand] = useState<SubscriberBand | null>(null);

  const finish = useMutation({
    mutationFn: (input: { channel: YouTubeChannelRef; band: SubscriberBand | null }) =>
      completeOnboarding(userId, input.channel, input.band),
    onSuccess: async () => {
      track.capture('onboarding_done');
      await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
      router.replace('/review');
    },
  });

  const onFinish = () => {
    const channel = parseYouTubeChannelUrl(url);
    if (!channel) {
      setUrlError(t('onboarding.channelInvalid'));
      return;
    }
    setUrlError(null);
    finish.mutate({ channel, band });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen gap={space.xxl} style={styles.page}>
        <View style={styles.section}>
          <Title>{t('onboarding.channelTitle')}</Title>
          <Small tone="muted">{t('onboarding.channelHint')}</Small>
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

        {finish.error ? <Small tone="accent">{t('auth.genericError')}</Small> : null}
        <Button
          title={t('onboarding.finish')}
          onPress={onFinish}
          disabled={url.trim().length === 0}
          loading={finish.isPending}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
