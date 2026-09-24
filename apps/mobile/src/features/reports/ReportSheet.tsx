import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Meta, Small, Title } from '@/components/Type';
import { TextField } from '@/components/TextField';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { t, type MessageKey } from '@/i18n';

import { reportContent, REPORT_REASONS, type ReportReason, type ReportTarget } from './api';

type Props = {
  target: ReportTarget;
  /** Açma düğmesinin metni; ekranın diline göre değişir. */
  label: string;
};

/** Rapor menüsü: sebep seç, isteğe bağlı not, gönder (PRODUCT §11). */
export function ReportSheet({ target, label }: Props) {
  const colors = Colors[useColorScheme()];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);

  const send = useMutation({
    mutationFn: () => reportContent(target, reason as ReportReason, note),
    onSuccess: () => {
      setDone(true);
      setOpen(false);
    },
  });

  if (done) {
    return <Meta>{t('report.thanks')}</Meta>;
  }

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} hitSlop={space.sm}>
        <Meta style={styles.trigger}>{label}</Meta>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View
            style={[
              styles.sheet,
              { borderColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <Title>{t('report.title')}</Title>
            <Small tone="muted">{t('report.body')}</Small>

            <View style={styles.reasons} accessibilityRole="radiogroup">
              {REPORT_REASONS.map((value) => (
                <Chip
                  key={value}
                  label={t(`report.reasons.${value}` as MessageKey)}
                  selected={reason === value}
                  onPress={() => setReason(value)}
                />
              ))}
            </View>

            <TextField
              label={t('report.noteLabel')}
              placeholder={t('report.notePlaceholder')}
              value={note}
              onChangeText={setNote}
              maxLength={200}
              multiline
            />

            {send.error ? (
              <Small tone="accent">
                {t(`report.errors.${reportErrorKey(send.error)}` as MessageKey)}
              </Small>
            ) : null}

            <Button
              title={t('report.send')}
              onPress={() => send.mutate()}
              disabled={!reason}
              loading={send.isPending}
            />
            <Button title={t('report.cancel')} variant="secondary" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

function reportErrorKey(error: Error): string {
  return ['no_access', 'invalid_reason', 'not_authenticated'].includes(error.message)
    ? error.message
    : 'unknown';
}

const styles = StyleSheet.create({
  trigger: {
    textDecorationLine: 'underline',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    padding: space.xl,
    gap: space.md,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
