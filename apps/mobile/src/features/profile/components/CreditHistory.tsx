import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { t, type MessageKey } from '@/i18n';

import type { CreditEntry } from '../api';

/** Kredi geçmişi: ledger append-only, burada yalnızca okunur (CLAUDE.md). */
export function CreditHistory({ entries }: { entries: CreditEntry[] }) {
  const colors = Colors[useColorScheme()];

  if (entries.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.muted }]}>{t('profile.credits.empty')}</Text>
    );
  }

  return (
    <View style={styles.list}>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.row}>
          <View style={styles.label}>
            <Text style={styles.reason}>
              {t(`profile.credits.reasons.${entry.reason}` as MessageKey)}
            </Text>
            <Text style={[styles.date, { color: colors.muted }]}>
              {new Date(entry.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={[styles.delta, { color: entry.delta > 0 ? colors.tint : colors.text }]}>
            {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    gap: 2,
  },
  reason: {
    fontSize: 15,
  },
  date: {
    fontSize: 12,
  },
  delta: {
    fontSize: 17,
    fontWeight: '700',
  },
  empty: {
    fontSize: 14,
  },
});
