import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { t } from '@/i18n';

import type { PickedThumbnail } from '../media.types';
import { MAX_THUMBNAILS } from '../rules';

type Props = {
  thumbnails: PickedThumbnail[];
  busy: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export function ThumbnailsStep({ thumbnails, busy, onAdd, onRemove }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('submit.wizard.thumbnailsTitle')}</Text>
      <Text style={styles.hint}>{t('submit.wizard.thumbnailsHint')}</Text>

      {thumbnails.map((thumbnail, index) => (
        <View key={thumbnail.uri} style={styles.item}>
          <Image
            source={{ uri: thumbnail.uri }}
            style={[styles.preview, { borderColor: colors.border }]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <Pressable accessibilityRole="button" onPress={() => onRemove(index)}>
            <Text style={[styles.remove, { color: colors.danger }]}>
              {t('submit.wizard.removeThumbnail')}
            </Text>
          </Pressable>
        </View>
      ))}

      {thumbnails.length < MAX_THUMBNAILS ? (
        <Button
          title={t('submit.wizard.addThumbnail')}
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
  item: {
    gap: 6,
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  remove: {
    fontSize: 14,
    fontWeight: '600',
  },
});
