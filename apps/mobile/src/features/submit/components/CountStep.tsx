import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
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
  const colors = Colors[useColorScheme()];
  const missing = creditCost(requested) - balance;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('submit.wizard.countTitle')}</Text>
      <Text style={styles.hint}>{t('submit.wizard.countHint')}</Text>

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

      <Text style={[styles.balance, { color: colors.muted }]}>
        {t('submit.wizard.balance', { balance })}
      </Text>

      {!canAfford(balance, requested) ? (
        <View style={styles.shortfall}>
          <Text style={[styles.warning, { color: colors.danger }]}>
            {t('submit.wizard.notEnough', { missing })}
          </Text>
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
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  hint: {
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.7,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  balance: {
    fontSize: 15,
  },
  shortfall: {
    gap: 8,
  },
  warning: {
    fontSize: 15,
    fontWeight: '600',
  },
});
