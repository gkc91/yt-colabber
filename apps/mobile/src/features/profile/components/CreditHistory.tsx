import { StyleSheet, View } from 'react-native';

import { Body, Meta, Small } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { space } from '@/design/tokens';
import { t, type MessageKey } from '@/i18n';

import type { CreditEntry } from '../api';

/** Kredi geçmişi: ledger append-only, burada yalnızca okunur (CLAUDE.md). */
export function CreditHistory({ entries }: { entries: CreditEntry[] }) {
  const colors = Colors[useColorScheme()];

  if (entries.length === 0) {
    return <Small tone="muted">{t('profile.credits.empty')}</Small>;
  }

  return (
    <View style={styles.list}>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.row}>
          <View style={styles.label}>
            <Body>{t(`profile.credits.reasons.${entry.reason}` as MessageKey)}</Body>
            <Meta>{new Date(entry.created_at).toLocaleDateString()}</Meta>
          </View>
          {/* Kazanç yeşil, harcama düz mürekkep: ekstre gibi okunsun. */}
          <Body style={[styles.delta, { color: entry.delta > 0 ? colors.positive : colors.text }]}>
            {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
          </Body>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  label: {
    gap: 2,
  },
  delta: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
