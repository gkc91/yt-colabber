import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, Title } from '@/components/Type';
import { space } from '@/design/tokens';
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
      <Title>{t('submit.wizard.confirmTitle')}</Title>
      <Body>
        {t('submit.wizard.confirmSummary', {
          thumbnails: thumbnails.length,
          titles: titles.length,
          seconds: clip.durationSeconds,
          count: requested,
        })}
      </Body>

      {uploading ? (
        <View style={styles.progressBlock}>
          <Body tone="muted">
            {progress && progress.done < progress.total
              ? t('submit.wizard.uploading', { done: progress.done, total: progress.total })
              : t('submit.wizard.creating')}
          </Body>
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
    gap: space.md,
  },
  progressBlock: {
    gap: space.md,
  },
});
