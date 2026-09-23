import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { t } from '@/i18n';

import type { PickedClip, PickedThumbnail } from '../media.types';
import type { ReviewCount } from '../rules';
import type { UploadProgress } from '../upload';

type Props = {
  thumbnails: PickedThumbnail[];
  titles: string[];
  clip: PickedClip;
  requested: ReviewCount;
  uploading: boolean;
  progress: UploadProgress | null;
  onStart: () => void;
  onCancel: () => void;
};

export function ConfirmStep({
  thumbnails,
  titles,
  clip,
  requested,
  uploading,
  progress,
  onStart,
  onCancel,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('submit.wizard.confirmTitle')}</Text>
      <Text style={styles.summary}>
        {t('submit.wizard.confirmSummary', {
          thumbnails: thumbnails.length,
          titles: titles.length,
          seconds: clip.durationSeconds,
          count: requested,
        })}
      </Text>

      {uploading ? (
        <View style={styles.progressBlock}>
          <Text style={styles.progress}>
            {progress && progress.done < progress.total
              ? t('submit.wizard.uploading', { done: progress.done, total: progress.total })
              : t('submit.wizard.creating')}
          </Text>
          <Button title={t('submit.wizard.cancel')} variant="secondary" onPress={onCancel} />
        </View>
      ) : (
        <Button title={t('submit.wizard.start')} onPress={onStart} />
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
  summary: {
    fontSize: 16,
    lineHeight: 22,
  },
  progressBlock: {
    gap: 12,
  },
  progress: {
    fontSize: 16,
  },
});
