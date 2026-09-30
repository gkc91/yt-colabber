// Eşleşmelerim (F3). PRODUCT §12.
//
// Liste `collab_matches_list()` RPC'sinden geliyor, düz select'ten değil: karşı tarafın adı
// ve kanalı `profiles`/`channels` içinde ve ikisi de "yalnızca kendini oku" politikasında.
// Yani bu ekran `security definer` bir fonksiyon olmadan çizilemez (0044).
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Heading, Label, Meta, Small } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { useMatches } from '@/features/collab/api';
import { matchName, type Match } from '@/features/collab/chat';
import { t, type MessageKey } from '@/i18n';

export default function MatchesScreen() {
  const matches = useMatches();
  const colors = Colors[useColorScheme()];

  if (matches.isPending) {
    return (
      <Screen center>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (matches.isError) {
    return (
      <Screen>
        <Heading>{t('collab.matches.errorTitle')}</Heading>
        <Body>{t('collab.error.body')}</Body>
        <Button title={t('collab.error.retry')} onPress={() => matches.refetch()} />
      </Screen>
    );
  }

  const list = matches.data ?? [];

  if (list.length === 0) {
    return (
      <Screen>
        <Heading>{t('collab.matches.emptyTitle')}</Heading>
        <Body>{t('collab.matches.emptyBody')}</Body>
        <Button title={t('collab.matches.browse')} onPress={() => router.push('/collab')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {list.map((match) => (
        <MatchRow key={match.id} match={match} unreadColor={colors.tint} />
      ))}
    </Screen>
  );
}

function MatchRow({ match, unreadColor }: { match: Match; unreadColor: string }) {
  const name = matchName(match, t('collab.card.unnamed'));
  return (
    <Pressable
      accessibilityRole="button"
      // Okunmamış sayısı etikete giriyor: rozet bir renk lekesi ve ekran okuyucu onu
      // okumaz; "3 okunmamış" bilgisinin görsel olmayan karşılığı burada.
      accessibilityLabel={
        match.unread > 0 ? t('collab.matches.rowUnread', { name, count: match.unread }) : name
      }
      onPress={() => router.push({ pathname: '/collab/[matchId]', params: { matchId: match.id } })}
    >
      <Card gap={space.sm}>
        <View style={styles.row}>
          <Label style={styles.name}>{name}</Label>
          {match.unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: unreadColor }]}>
              <Meta style={styles.badgeText}>{String(match.unread)}</Meta>
            </View>
          ) : null}
        </View>
        {match.band ? <Meta>{t(`onboarding.bands.${match.band}` as MessageKey)}</Meta> : null}
        {/* Henüz konuşulmadıysa son mesaj yerine ne yapacağını söylüyoruz. */}
        <Small tone="muted" numberOfLines={1}>
          {match.lastMessage ?? t('collab.matches.noMessages')}
        </Small>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  name: {
    flex: 1,
  },
  badge: {
    minWidth: 24,
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
  },
});
