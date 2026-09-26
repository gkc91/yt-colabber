import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Label, Small, Title } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { t } from '@/i18n';

import type { FeedItem } from '../rules';

type Props = {
  picked: FeedItem;
  candidate: FeedItem;
  vertical?: boolean;
  onContinue: () => void;
};

/**
 * Izgara ile videonun arasındaki adım. Eskiden seçim yapılır yapılmaz test sahibinin
 * videosu açılıyordu; kişi ne seçtiğini ve neden bu videoya baktığını anlamadan akışın
 * içinde buluyordu kendini. Ölçüm buraya gelindiğinde bitmiş oluyor (tıklama kaydedildi),
 * o yüzden burada adayı göstermek testi bozmaz.
 */
export function RevealStep({ picked, candidate, vertical = false, onContinue }: Props) {
  const colors = Colors[useColorScheme()];
  const hit = picked.kind === 'candidate';

  return (
    <View style={styles.container}>
      <Title>{t(hit ? 'review.reveal.hitTitle' : 'review.reveal.missTitle')}</Title>
      <Small tone="muted">{t('review.reveal.body')}</Small>

      <View style={styles.row}>
        {/* Isabet ettiyse tek kart gösterilir: aynı görseli yan yana iki kez koymak
            "iki farklı video" izlenimi verirdi. */}
        {!hit ? (
          <View style={styles.cell}>
            <Label>{t('review.reveal.youPicked')}</Label>
            <Image
              source={{ uri: picked.thumbnailUrl }}
              style={[
                styles.thumbnail,
                vertical ? styles.vertical : styles.horizontal,
                { borderColor: colors.border },
              ]}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <Small numberOfLines={2}>{picked.title}</Small>
          </View>
        ) : null}

        <View style={styles.cell}>
          <Label>{t('review.reveal.tested')}</Label>
          <Image
            source={{ uri: candidate.thumbnailUrl }}
            style={[
              styles.thumbnail,
              vertical ? styles.vertical : styles.horizontal,
              { borderColor: colors.border },
            ]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <Small numberOfLines={2}>{candidate.title}</Small>
        </View>
      </View>

      <Button title={t('review.reveal.continue')} onPress={onContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
  },
  cell: {
    flex: 1,
    gap: space.sm,
  },
  thumbnail: {
    width: '100%',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  horizontal: {
    aspectRatio: 16 / 9,
  },
  vertical: {
    aspectRatio: 9 / 16,
  },
});
