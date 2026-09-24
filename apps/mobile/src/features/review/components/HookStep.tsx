import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Body, Meta } from '@/components/Type';
import { TextField } from '@/components/TextField';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { t, type MessageKey } from '@/i18n';

import { ReportSheet } from '@/features/reports/ReportSheet';

import { REASON_TAGS, toggleTag, type ReasonTag } from '../rules';

type Props = {
  submissionId: string;
  clipUrl: string;
  comment: string;
  tags: ReasonTag[];
  submitting: boolean;
  onChangeComment: (comment: string) => void;
  onChangeTags: (tags: ReasonTag[]) => void;
  /** leftAt: saniye, null = sonuna kadar izledi */
  onFinish: (leftAt: number | null) => void;
};

/** Adım 3 — hook testi: klip oynar, "buradan çıktım" ya da sonuna kadar (PRODUCT §5). */
export function HookStep({
  submissionId,
  clipUrl,
  comment,
  tags,
  submitting,
  onChangeComment,
  onChangeTags,
  onFinish,
}: Props) {
  const colors = Colors[useColorScheme()];
  const [leftAt, setLeftAt] = useState<number | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  const player = useVideoPlayer(clipUrl, (instance) => {
    instance.timeUpdateEventInterval = 1;
    instance.play();
  });

  useEventListener(player, 'playToEnd', () => {
    setReachedEnd(true);
    setLeftAt(null);
  });

  const markLeft = () => {
    player.pause();
    setLeftAt(player.currentTime);
  };

  const decided = reachedEnd || leftAt !== null;

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={[styles.video, { borderColor: colors.border }]}
        contentFit="contain"
        nativeControls={false}
        accessibilityLabel={t('review.hook.video')}
      />

      {!decided ? (
        <Button title={t('review.hook.leave')} variant="secondary" onPress={markLeft} />
      ) : (
        <Body style={styles.decision}>
          {leftAt === null
            ? t('review.hook.watchedAll')
            : t('review.hook.leftAt', { second: Math.floor(leftAt) })}
        </Body>
      )}

      {decided ? (
        <>
          <Meta style={styles.label}>{t('review.hook.tagsTitle')}</Meta>
          <View style={styles.tags}>
            {REASON_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={t(`review.tags.${tag}` as MessageKey)}
                role="checkbox"
                selected={tags.includes(tag)}
                onPress={() => onChangeTags(toggleTag(tags, tag))}
              />
            ))}
          </View>

          <TextField
            label={t('review.hook.commentLabel')}
            placeholder={t('review.hook.commentPlaceholder')}
            value={comment}
            onChangeText={onChangeComment}
            maxLength={200}
            multiline
          />

          <Button
            title={t('review.hook.submit')}
            onPress={() => onFinish(leftAt)}
            loading={submitting}
          />
          <ReportSheet
            target={{ type: 'submission', id: submissionId }}
            label={t('report.reportTest')}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: '#000',
  },
  decision: {
    fontWeight: '600',
  },
  label: {
    textTransform: 'uppercase',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
