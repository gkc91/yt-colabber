import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
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
    return <Text style={[styles.done, { color: colors.muted }]}>{t('report.thanks')}</Text>;
  }

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <Text style={[styles.trigger, { color: colors.muted }]}>{label}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { borderColor: colors.border }]}>
            <Text style={styles.title}>{t('report.title')}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{t('report.body')}</Text>

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
              <Text style={[styles.body, { color: colors.danger }]}>
                {t(`report.errors.${reportErrorKey(send.error)}` as MessageKey)}
              </Text>
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
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  done: {
    fontSize: 13,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    padding: 20,
    gap: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
