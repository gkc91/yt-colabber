import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Meta, Small, Title } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { t } from '@/i18n';

import type { PickedThumbnail } from '../media.types';
import { MAX_THUMBNAILS } from '../rules';

type Props = {
  thumbnails: PickedThumbnail[];
  /** Dikey testte kapak da dikey: önizleme yanlış oranda gösterilirse kırpılmış sanılır. */
  vertical?: boolean;
  busy: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export function ThumbnailsStep({ thumbnails, vertical = false, busy, onAdd, onRemove }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      <Title>{t('submit.wizard.thumbnailsTitle')}</Title>
      <Small tone="muted">{t('submit.wizard.thumbnailsHint')}</Small>

      {thumbnails.map((thumbnail, index) => (
        <View key={thumbnail.uri} style={styles.item}>
          <Image
            source={{ uri: thumbnail.uri }}
            style={[
              styles.preview,
              vertical ? styles.previewVertical : styles.previewHorizontal,
              { borderColor: colors.border },
            ]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.row}>
            {/* Ne eklediğini ekledikten sonra da görebilsin: ad yoksa sırasıyla numara. */}
            <Meta style={styles.name} numberOfLines={1}>
              {thumbnail.name ?? t('submit.wizard.thumbnailNumber', { index: index + 1 })}
            </Meta>
            <Pressable
              accessibilityRole="button"
              onPress={() => onRemove(index)}
              hitSlop={space.sm}
            >
              <Meta tone="accent">{t('submit.wizard.removeThumbnail')}</Meta>
            </Pressable>
          </View>
        </View>
      ))}

      {thumbnails.length < MAX_THUMBNAILS ? (
        <Button
          title={
            Platform.OS === 'web'
              ? t('submit.wizard.addThumbnailWeb')
              : t('submit.wizard.addThumbnail')
          }
          variant="secondary"
          onPress={onAdd}
          loading={busy}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  item: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  // Uzun ad "Remove"u ekrandan itmesin: büyüyen metin küçülebilmeli (DESIGN §4).
  name: {
    flex: 1,
    minWidth: 0,
  },
  // Ölçüler her varyantın KENDİ içinde: ortak stile `width: '100%'` koyup dikeyde
  // `width: 'auto'` ile ezmek Android'de sıfır genişliğe çözülüyordu ve önizleme hiç
  // çizilmiyordu — yatayda görünmeyen, yalnızca dikey testte çıkan bir hata (2026-09-29).
  previewHorizontal: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  previewVertical: {
    height: 320,
    aspectRatio: 9 / 16,
    alignSelf: 'center',
  },
  preview: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
