import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
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

export default function NewSubmission() {
  // PRODUCT §14: submission oluşturma yalnızca uygulamada (video seçme/sıkıştırma cihaz işi).
  if (Platform.OS === 'web') return <WebNotice />;
  return <Wizard />;
}

function WebNotice() {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>{t('submit.webOnly.title')}</Text>
      <Text style={styles.noticeBody}>{t('submit.webOnly.body')}</Text>
    </View>
  );
}

function Wizard() {
  const { session } = useSession();
  const userId = session?.user.id as string;
  const queryClient = useQueryClient();
  const colors = Colors[useColorScheme()];

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
          ? (`submit.errors.${e.code}` as MessageKey)
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.step, { color: colors.muted }]}>
        {t('submit.wizard.step', { current: step + 1, total: STEPS })}
      </Text>

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

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{t(error)}</Text> : null}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 20,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  step: {
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    fontSize: 15,
  },
  nav: {
    flexDirection: 'row',
    gap: 12,
  },
  navItem: {
    flex: 1,
  },
  notice: {
    // Web'de bu ekran uzun bir kapsayıcının içinde açılıyor; flex ile ortalamak metni
    // sayfanın dibine düşürüyordu. Üstten hizalayıp genişliği sınırlıyoruz.
    padding: 24,
    paddingTop: 32,
    gap: 12,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  noticeTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  noticeBody: {
    fontSize: 16,
    lineHeight: 22,
  },
});
