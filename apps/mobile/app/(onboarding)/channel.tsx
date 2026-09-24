import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { Text, View } from '@/components/Themed';
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.title}>{t('onboarding.channelTitle')}</Text>
          <Text style={styles.hint}>{t('onboarding.channelHint')}</Text>
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
          <Text style={styles.subtitle}>{t('onboarding.bandTitle')}</Text>
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

        {finish.error ? <Text style={styles.error}>{t('auth.genericError')}</Text> : null}
        <Button
          title={t('onboarding.finish')}
          onPress={onFinish}
          disabled={url.trim().length === 0}
          loading={finish.isPending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
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
