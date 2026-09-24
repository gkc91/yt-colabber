import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Meta, Small, Title } from '@/components/Type';
import { space } from '@/design/tokens';
import { t } from '@/i18n';

import {
  canAfford,
  creditCost,
  PRO_REVIEW_COUNT,
  reviewCountOptions,
  type ReviewCount,
} from '../rules';

type Props = {
  requested: ReviewCount;
  balance: number;
  isPro: boolean;
  onChange: (count: ReviewCount) => void;
};

export function CountStep({ requested, balance, isPro, onChange }: Props) {
  const missing = creditCost(requested) - balance;

  return (
    <View style={styles.container}>
      <Title>{t('submit.wizard.countTitle')}</Title>
      <Small tone="muted">{t('submit.wizard.countHint')}</Small>

      <View style={styles.options} accessibilityRole="radiogroup">
        {reviewCountOptions(isPro).map((count) => (
          <Chip
            key={count}
            label={
              count === PRO_REVIEW_COUNT && !isPro
                ? `${count} · ${t('submit.wizard.proOnly')}`
                : t('submit.wizard.countOption', { count })
            }
            selected={count === requested}
            onPress={() => onChange(count)}
          />
        ))}
      </View>

      <Meta>{t('submit.wizard.balance', { balance })}</Meta>

      {!canAfford(balance, requested) ? (
        <View style={styles.shortfall}>
          <Small tone="accent" style={styles.warning}>
            {t('submit.wizard.notEnough', { missing })}
          </Small>
          <Button
            title={t('submit.wizard.getCredits')}
            variant="secondary"
            onPress={() => router.push('/paywall')}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  shortfall: {
    gap: space.sm,
  },
  warning: {
    fontWeight: '600',
  },
});
