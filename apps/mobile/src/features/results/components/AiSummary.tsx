import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Body, Meta, Small } from '@/components/Type';
import { space } from '@/design/tokens';
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
  const status = useAiSummaryStatus(submissionId, summary === null);
  const generate = useGenerateAiSummary(submissionId);

  // Yazılmış özet raporun ilk sözüdür: kart değil, sayfanın kendi sesi.
  if (summary) {
    return (
      <View style={styles.written}>
        <Meta style={styles.label}>{t('results.aiSummary.title')}</Meta>
        <Body>{summary}</Body>
      </View>
    );
  }

  // Durum okunamıyorsa (ör. sunucuda özellik kapalı) bölümü hiç göstermeyiz:
  // olmayan bir şeyi vaat etmiş olmayalım.
  if (status.isPending) return null;
  if (status.error || !status.data) return null;

  const { reason } = status.data;

  return (
    <Card gap={space.md}>
      <Meta style={styles.label}>{t('results.aiSummary.title')}</Meta>
      <Small tone="muted">{explain(status.data)}</Small>

      {reason === 'ok' ? (
        <>
          <Button
            title={t('results.aiSummary.generate')}
            onPress={() => generate.mutate()}
            loading={generate.isPending}
          />
          <Meta>
            {t('results.aiSummary.quota', {
              used: status.data.used,
              limit: status.data.limit,
            })}
          </Meta>
        </>
      ) : null}

      {generate.isPending ? <ActivityIndicator /> : null}

      {generate.error ? (
        <Small tone="accent">
          {t(
            `results.aiSummary.errors.${
              generate.error instanceof AiSummaryError ? generate.error.message : 'summary_failed'
            }` as MessageKey,
          )}
        </Small>
      ) : null}
    </Card>
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
  written: {
    gap: space.sm,
  },
  label: {
    textTransform: 'uppercase',
  },
});
