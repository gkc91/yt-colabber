// Aday kartı (F2). Tek bir kişi: kanal, band, türler, bio ve aranızdaki değerlendirme
// geçmişi. PRODUCT §12'de adaylar bu geçmişe göre SIRALANIYOR; kartta yazılmazsa
// kullanıcı listenin neden o sırada olduğunu anlamaz.
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Body, Heading, Meta, Small } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { t, type MessageKey } from '@/i18n';

import { candidateName, historyKind, type Candidate } from '../candidates';

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  const colors = Colors[useColorScheme()];
  const name = candidateName(candidate, t('collab.card.unnamed'));
  const kind = historyKind(candidate);

  return (
    <Card gap={space.md}>
      <Heading>{name}</Heading>

      <View style={styles.meta}>
        {candidate.band ? (
          <Meta>{t(`onboarding.bands.${candidate.band}` as MessageKey)}</Meta>
        ) : null}
        {/*
          Kanal bağlantısı PRODUCT §12 gereği burada gösteriliyor ve §9 gereği hiçbir
          şekilde ödüllendirilmiyor: tıklamak kredi vermez, görev değildir, izlemesi
          beklenmez. Sadece "bu kim" sorusunun cevabı.
        */}
        {candidate.youtubeUrl ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={space.sm}
            onPress={() => Linking.openURL(candidate.youtubeUrl as string)}
          >
            <Meta>{t('collab.card.openChannel')}</Meta>
          </Pressable>
        ) : null}
      </View>

      {kind !== 'none' ? (
        <Small tone="muted">
          {t(`collab.card.history.${kind}` as MessageKey, {
            they: candidate.reviewedMe,
            me: candidate.iReviewed,
          })}
        </Small>
      ) : null}

      {/*
        Rozetler SALT OKUNUR, bu yüzden `Chip` DEĞİL. Chip bir onay kutusudur: ekran
        okuyucu "işaretli onay kutusu" der ve kullanıcı basıp bir şey olmasını bekler.
        Burada seçilecek bir şey yok, yalnızca karşı tarafın neye açık olduğu yazıyor.
      */}
      {candidate.types.length > 0 ? (
        <View style={styles.chips}>
          {candidate.types.map((type) => (
            <View key={type} style={[styles.badge, { borderColor: colors.border }]}>
              <Small>{t(`profile.collab.kinds.${type}` as MessageKey)}</Small>
            </View>
          ))}
        </View>
      ) : null}

      {candidate.bio ? <Body>{candidate.bio}</Body> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
});
