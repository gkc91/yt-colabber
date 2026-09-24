import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, Small, Title } from '@/components/Type';
import { space } from '@/design/tokens';
import { t } from '@/i18n';

import type { PickedClip } from '../media.types';

type Props = {
  clip: PickedClip | null;
  busy: boolean;
  progress: number;
  onPick: () => void;
};

export function ClipStep({ clip, busy, progress, onPick }: Props) {
  return (
    <View style={styles.container}>
      <Title>{t('submit.wizard.clipTitle')}</Title>
      <Small tone="muted">
        {Platform.OS === 'web' ? t('submit.wizard.clipHintWeb') : t('submit.wizard.clipHint')}
      </Small>

      {clip ? (
        <Body tone="positive" style={styles.ready}>
          {t('submit.wizard.clipReady', {
            seconds: clip.durationSeconds,
            megabytes: (clip.bytes / (1024 * 1024)).toFixed(1),
          })}
        </Body>
      ) : null}

      {busy ? (
        <Body>{t('submit.wizard.compressing', { percent: Math.round(progress * 100) })}</Body>
      ) : (
        <Button
          title={
            clip
              ? t('submit.wizard.replaceClip')
              : Platform.OS === 'web'
                ? t('submit.wizard.pickClipWeb')
                : t('submit.wizard.pickClip')
          }
          variant="secondary"
          onPress={onPick}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  ready: {
    fontWeight: '600',
  },
});
