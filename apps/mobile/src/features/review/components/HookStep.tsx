import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Body, Heading, Meta, Small } from '@/components/Type';
import { TextField } from '@/components/TextField';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { t, type MessageKey } from '@/i18n';

import { ReportSheet } from '@/features/reports/ReportSheet';

import { tagsFor, toggleTag, type ReasonTag } from '../rules';

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

/** Oynat düğmesinin yazısı durumu söyler: yükleniyor, hata, ya da hazır. */
const overlayKey = (status: VideoPlayerStatus) =>
  status === 'error'
    ? 'review.hook.playAgain'
    : status === 'loading'
      ? 'review.hook.loading'
      : 'review.hook.play';

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
  // Mobil tarayıcılar sesli videonun kendiliğinden başlamasını engeller (2026-09-24 canlı
  // bulgu: değerlendirme 0 sn izlemeyle kaydedildi). Oynamadıysa büyük bir "oynat" düğmesi
  // gösteririz; dokunuş kullanıcı hareketi sayıldığı için ses açık başlar.
  const [started, setStarted] = useState(false);
  // Oynatıcının durumu ekranda görünmeli: yüklenirken sessiz duran bir kare kullanıcıya
  // "video yok, buraya resim koymuşlar" dedirtiyor (2026-09-25 bulgusu).
  const [status, setStatus] = useState<VideoPlayerStatus>('idle');

  const player = useVideoPlayer(clipUrl, (instance) => {
    instance.timeUpdateEventInterval = 1;
    instance.play();
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) setStarted(true);
  });
  useEventListener(player, 'statusChange', ({ status: next }) => setStatus(next));

  const play = () => player.play();

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
        // Telefon tarayıcıları bu bayrak olmadan videoyu sayfa içinde oynatmayı reddeder
        // (2026-09-25 canlı bulgu: PC'de oynadı, telefonda oynamadı; veri yüklenmişti,
        // readyState 4, hata yoktu — engelleyen tek şey buydu).
        playsInline
        accessibilityLabel={t('review.hook.video')}
      />
      {!started && !decided ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(overlayKey(status))}
          onPress={play}
          disabled={status === 'loading'}
          style={styles.overlay}
        >
          <View style={[styles.playButton, { backgroundColor: colors.background }]}>
            {status === 'loading' ? (
              <ActivityIndicator />
            ) : (
              <Heading>{t(overlayKey(status))}</Heading>
            )}
          </View>
          {status === 'error' ? (
            <Small style={styles.overlayNote}>{t('review.hook.loadFailed')}</Small>
          ) : null}
        </Pressable>
      ) : null}

      {!decided ? (
        // Video başlamadan "burada çıktım" anlamsız: 0. saniye verisi sonucu bozar.
        <Button
          title={t('review.hook.leave')}
          variant="secondary"
          onPress={markLeft}
          disabled={!started}
        />
      ) : (
        <Body style={styles.decision}>
          {leftAt === null
            ? t('review.hook.watchedAll')
            : t('review.hook.leftAt', { second: Math.floor(leftAt) })}
        </Body>
      )}

      {decided ? (
        <>
          {/* Bıraktıysa neyin kaçırdığını, sonuna kadar izlediyse neyin tuttuğunu sorarız. */}
          <Meta style={styles.label}>
            {t(leftAt === null ? 'review.hook.tagsTitleStayed' : 'review.hook.tagsTitle')}
          </Meta>
          <View style={styles.tags}>
            {tagsFor(leftAt).map((tag) => (
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  playButton: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
  },
  overlayNote: {
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: space.lg,
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
