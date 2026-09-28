import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { Label, Small } from '@/components/Type';
import { space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import { t, type MessageKey } from '@/i18n';

import { AppealFailed, useAppeal } from './api';

type Props = {
  submissionId: string;
  reason: string | null;
};

/**
 * Gizlenen testin sahibine gösterilen kutu: neden durduğu, kredisinin geri geldiği ve
 * itiraz yolu. Eskiden `hidden` tek yönlüydü — test sessizce durur, sahibi sebebini
 * öğrenemez, itiraz edemezdi. Otomatik kural tek ağır raporla gizleyebildiği için (0029)
 * bu kutu o kuralın karşılığı: karar insana açılıyor.
 */
export function AppealSheet({ submissionId, reason }: Props) {
  const { session } = useSession();
  const appeal = useAppeal(session?.user.id);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const reasonKey = `submit.hidden.reason.${reason ?? 'other'}` as MessageKey;
  const errorKey =
    appeal.error instanceof AppealFailed
      ? (`submit.hidden.errors.${appeal.error.code}` as MessageKey)
      : appeal.error
        ? ('submit.hidden.errors.unknown' as MessageKey)
        : null;

  return (
    <Card gap={space.md}>
      <Label>{t('submit.hidden.title')}</Label>
      <Small tone="muted">{t(reasonKey)}</Small>
      <Small tone="muted">{t('submit.hidden.body')}</Small>

      {appeal.isSuccess ? <Small tone="positive">{t('submit.hidden.sent')}</Small> : null}

      {!appeal.isSuccess && open ? (
        <View style={styles.form}>
          <TextField
            label={t('submit.hidden.noteLabel')}
            placeholder={t('submit.hidden.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            multiline
          />
          {errorKey ? <Small tone="accent">{t(errorKey)}</Small> : null}
          <Button
            title={t('submit.hidden.send')}
            loading={appeal.isPending}
            onPress={() => appeal.mutate({ submissionId, note })}
          />
          <Button
            title={t('submit.hidden.cancel')}
            variant="secondary"
            onPress={() => setOpen(false)}
          />
        </View>
      ) : null}

      {!appeal.isSuccess && !open ? (
        <Button
          title={t('submit.hidden.appeal')}
          variant="secondary"
          onPress={() => setOpen(true)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.md,
  },
});
