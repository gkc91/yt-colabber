import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Meta, Small } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import { useBalance } from '@/features/credits/api';
import { useIsPro } from '@/features/profile/api';
import { SubmissionFailed } from '@/features/submit/api';
import { ClipStep } from '@/features/submit/components/ClipStep';
import { ConfirmStep } from '@/features/submit/components/ConfirmStep';
import { CountStep } from '@/features/submit/components/CountStep';
import { ThumbnailsStep } from '@/features/submit/components/ThumbnailsStep';
import { TitlesStep } from '@/features/submit/components/TitlesStep';
import {
  ClipError,
  pickClip,
  pickThumbnails,
  type PickedClip,
  type PickedThumbnail,
} from '@/features/submit/media';
import { canAfford, cleanTitles, validateTitles, type ReviewCount } from '@/features/submit/rules';
import { Cancelled, uploadAndCreate, type UploadProgress } from '@/features/submit/upload';
import { track } from '@/lib/track';
import { t, type MessageKey } from '@/i18n';

const STEPS = 5;

/**
 * Aynı kural, iki farklı çözüm: uygulamada seçici videoyu kırpıyor, tarayıcıda
 * kullanıcının editöründen 60 saniyelik dışa aktarması gerekiyor.
 */
function clipErrorKey(code: string): string {
  if (code === 'clip_too_long' && Platform.OS === 'web') return 'clip_too_long_web';
  return code;
}

export default function NewSubmission() {
  // E5: masaüstünden de test açılabiliyor. Fark: cihazda uzun video 60 saniyeye kesilip
  // sıkıştırılıyor, tarayıcıda sıkıştırma yok — dosya zaten kurallara uymalı.
  return <Wizard />;
}

/** Ne beklediğimizi baştan söyleriz; kullanıcı kuralları hata mesajıyla öğrenmesin. */
function Requirements() {
  return (
    <Card gap={space.sm}>
      <Meta style={styles.requirementsTitle}>{t('submit.requirements.title')}</Meta>
      <Small tone="muted">{t('submit.requirements.thumbnails')}</Small>
      <Small tone="muted">{t('submit.requirements.titles')}</Small>
      <Small tone="muted">
        {Platform.OS === 'web'
          ? t('submit.requirements.clipWeb')
          : t('submit.requirements.clipApp')}
      </Small>
    </Card>
  );
}

/** Adım çubuğu: dekorasyon değil, kaç adım kaldığının cevabı (DESIGN.md §8). */
function StepBar({ step, total }: { step: number; total: number }) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={styles.stepBar}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.stepSegment,
            { backgroundColor: index <= step ? colors.text : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

function Wizard() {
  const { session } = useSession();
  const userId = session?.user.id as string;
  const queryClient = useQueryClient();

  const balance = useBalance(userId).data ?? 0;
  const isPro = useIsPro(userId).data ?? false;

  const [step, setStep] = useState(0);
  const [thumbnails, setThumbnails] = useState<PickedThumbnail[]>([]);
  const [titles, setTitles] = useState<string[]>(['']);
  const [clip, setClip] = useState<PickedClip | null>(null);
  const [requested, setRequested] = useState<ReviewCount>(5);

  const [busy, setBusy] = useState(false);
  const [clipProgress, setClipProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const cancelled = useRef(false);

  const addThumbnails = async () => {
    setError(null);
    setBusy(true);
    try {
      const picked = await pickThumbnails(3 - thumbnails.length);
      setThumbnails((current) => [...current, ...picked].slice(0, 3));
    } catch {
      setError('submit.errors.unknown');
    } finally {
      setBusy(false);
    }
  };

  const chooseClip = async () => {
    setError(null);
    setBusy(true);
    setClipProgress(0);
    try {
      const picked = await pickClip(setClipProgress);
      if (picked) setClip(picked);
    } catch (e) {
      setError(
        e instanceof ClipError
          ? (`submit.errors.${clipErrorKey(e.code)}` as MessageKey)
          : 'submit.errors.unknown',
      );
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!clip) return;
    setError(null);
    cancelled.current = false;
    setUploading(true);
    setUploadProgress({ done: 0, total: thumbnails.length + 1 });
    try {
      await uploadAndCreate(
        { userId, thumbnails, titles: cleanTitles(titles), clip, requested },
        { onProgress: setUploadProgress, isCancelled: () => cancelled.current },
      );
      track.capture('submission_created', {
        requested,
        thumbnails: thumbnails.length,
        titles: cleanTitles(titles).length,
        clip_seconds: clip.durationSeconds,
      });
      await queryClient.invalidateQueries({ queryKey: ['balance', userId] });
      await queryClient.invalidateQueries({ queryKey: ['submissions', userId] });
      router.replace('/submit');
    } catch (e) {
      if (e instanceof Cancelled) setError('submit.wizard.cancelled');
      else if (e instanceof SubmissionFailed) setError(`submit.errors.${e.code}` as MessageKey);
      else setError('submit.errors.unknown');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const titleProblem = validateTitles(titles);
  const canGoNext = [
    thumbnails.length > 0,
    titleProblem === null,
    clip !== null,
    canAfford(balance, requested),
    true,
  ][step];

  const goNext = () => {
    if (step === 1 && titleProblem) {
      setError(`submit.errors.${titleProblem}` as MessageKey);
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, STEPS - 1));
  };

  return (
    <Screen gap={space.xl}>
      <View style={styles.header}>
        <Meta style={styles.step}>
          {t('submit.wizard.step', { current: step + 1, total: STEPS })}
        </Meta>
        <StepBar step={step} total={STEPS} />
      </View>

      {step === 0 ? <Requirements /> : null}

      {step === 0 ? (
        <ThumbnailsStep
          thumbnails={thumbnails}
          busy={busy}
          onAdd={addThumbnails}
          onRemove={(index) => setThumbnails((current) => current.filter((_, i) => i !== index))}
        />
      ) : null}
      {step === 1 ? <TitlesStep titles={titles} onChange={setTitles} /> : null}
      {step === 2 ? (
        <ClipStep clip={clip} busy={busy} progress={clipProgress} onPick={chooseClip} />
      ) : null}
      {step === 3 ? (
        <CountStep requested={requested} balance={balance} isPro={isPro} onChange={setRequested} />
      ) : null}
      {step === 4 && clip ? (
        <ConfirmStep
          thumbnails={thumbnails}
          titles={cleanTitles(titles)}
          clip={clip}
          requested={requested}
          uploading={uploading}
          progress={uploadProgress}
          onStart={start}
          onCancel={() => {
            cancelled.current = true;
          }}
        />
      ) : null}

      {error ? <Small tone="accent">{t(error)}</Small> : null}

      {!uploading ? (
        <View style={styles.nav}>
          {step > 0 ? (
            <View style={styles.navItem}>
              <Button
                title={t('submit.wizard.back')}
                variant="secondary"
                onPress={() => setStep((current) => current - 1)}
              />
            </View>
          ) : null}
          {step < STEPS - 1 ? (
            <View style={styles.navItem}>
              <Button title={t('submit.wizard.next')} onPress={goNext} disabled={!canGoNext} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space.sm,
  },
  step: {
    textTransform: 'uppercase',
  },
  stepBar: {
    flexDirection: 'row',
    gap: space.xs,
  },
  stepSegment: {
    flex: 1,
    height: 2,
  },
  nav: {
    flexDirection: 'row',
    gap: space.md,
  },
  navItem: {
    flex: 1,
  },
  requirementsTitle: {
    textTransform: 'uppercase',
  },
});
