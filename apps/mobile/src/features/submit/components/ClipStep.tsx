import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Text, View } from '@/components/Themed';
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
      <Text style={styles.title}>{t('submit.wizard.clipTitle')}</Text>
      <Text style={styles.hint}>{t('submit.wizard.clipHint')}</Text>

      {clip ? (
        <Text style={styles.ready}>
          {t('submit.wizard.clipReady', {
            seconds: clip.durationSeconds,
            megabytes: (clip.bytes / (1024 * 1024)).toFixed(1),
          })}
        </Text>
      ) : null}

      {busy ? (
        <Text style={styles.progress}>
          {t('submit.wizard.compressing', { percent: Math.round(progress * 100) })}
        </Text>
      ) : (
        <Button
          title={clip ? t('submit.wizard.replaceClip') : t('submit.wizard.pickClip')}
          variant="secondary"
          onPress={onPick}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  ready: {
    fontSize: 16,
    fontWeight: '600',
  },
  progress: {
    fontSize: 16,
  },
});
