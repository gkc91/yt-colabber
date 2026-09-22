import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useSession } from '@/features/auth/session';
import { useBalance } from '@/features/credits/api';
import { t } from '@/i18n';

export default function ReviewScreen() {
  const { session } = useSession();
  const balance = useBalance(session?.user.id);

  return (
    <View style={styles.container}>
      <View style={styles.balance} accessibilityRole="summary">
        <Text style={styles.balanceLabel}>{t('credits.balance')}</Text>
        <Text style={styles.balanceValue} testID="credit-balance">
          {balance.data ?? t('credits.loading')}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.message}>{t('placeholder.review')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  balanceLabel: {
    fontSize: 15,
    opacity: 0.7,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
});
