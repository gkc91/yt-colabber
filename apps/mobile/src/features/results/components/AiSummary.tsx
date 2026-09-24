import { ActivityIndicator, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { t, type MessageKey } from '@/i18n';

import {
  AiSummaryError,
  useAiSummaryStatus,
  useGenerateAiSummary,
  type AiSummaryStatus,
} from '../aiSummary';

/**
 * Pro'ya özel AI özeti (D3). Üretim kuralları sunucuda; burada yalnızca sunucunun
 * verdiği sebep gösterilir ve kalan hak yazılır — kullanıcı neden üretemediğini
 * tahmin etmek zorunda kalmasın.
 */
export function AiSummary({
  submissionId,
  summary,
}: {
  submissionId: string;
  summary: string | null;
}) {
  const colors = Colors[useColorScheme()];
  const status = useAiSummaryStatus(submissionId, summary === null);
  const generate = useGenerateAiSummary(submissionId);

  if (summary) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('results.aiSummary.title')}</Text>
        <Text style={styles.body}>{summary}</Text>
      </View>
    );
  }

  // Durum okunamıyorsa (ör. sunucuda özellik kapalı) bölümü hiç göstermeyiz:
  // olmayan bir şeyi vaat etmiş olmayalım.
  if (status.isPending) return null;
  if (status.error || !status.data) return null;

  const { reason } = status.data;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('results.aiSummary.title')}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{explain(status.data)}</Text>

      {reason === 'ok' ? (
        <>
          <Button
            title={t('results.aiSummary.generate')}
            onPress={() => generate.mutate()}
            loading={generate.isPending}
          />
          <Text style={[styles.note, { color: colors.muted }]}>
            {t('results.aiSummary.quota', {
              used: status.data.used,
              limit: status.data.limit,
            })}
          </Text>
        </>
      ) : null}

      {generate.isPending ? <ActivityIndicator /> : null}

      {generate.error ? (
        <Text style={[styles.body, { color: colors.danger }]}>
          {t(
            `results.aiSummary.errors.${
              generate.error instanceof AiSummaryError ? generate.error.message : 'summary_failed'
            }` as MessageKey,
          )}
        </Text>
      ) : null}
    </View>
  );
}

function explain(status: AiSummaryStatus): string {
  switch (status.reason) {
    case 'ok':
      return t('results.aiSummary.ready');
    case 'pro_required':
      return t('results.aiSummary.proRequired');
    case 'not_enough_reviews':
      return t('results.aiSummary.notEnoughReviews', {
        have: status.receivedReviews,
        need: status.minReviews,
      });
    case 'monthly_limit':
      return t('results.aiSummary.monthlyLimit', { limit: status.limit });
    default:
      return t('results.aiSummary.ready');
  }
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  note: {
    fontSize: 13,
  },
});
