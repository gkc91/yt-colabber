import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, Display, Meta } from '@/components/Type';
import { space } from '@/design/tokens';
import { t } from '@/i18n';

import { fetchReviewedChannel } from '../api';

type Props = { submissionId: string };

/**
 * "+1 kredi" ekranı. Kanal bağlantısı YALNIZCA burada, yani değerlendirme gönderildikten
 * sonra görünür (PRODUCT §5): önce gösterilseydi değerlendirici kanalı tanır ve feed
 * testi "tanımayan birinin tepkisi" olmaktan çıkardı. Ziyaret sayılmaz, ödül değildir.
 */
export function DoneStep({ submissionId }: Props) {
  const channel = useQuery({
    queryKey: ['reviewed-channel', submissionId],
    queryFn: () => fetchReviewedChannel(submissionId),
  });

  const url = channel.data?.youtube_url;

  return (
    <View style={styles.container}>
      {/* Kredi kazanıldı: sayfadaki tek büyük rakam odur. */}
      <Display tone="positive" style={styles.centered}>
        {t('review.done.reward')}
      </Display>
      <Body tone="muted" style={styles.centered}>
        {t('review.done.body')}
      </Body>

      {url ? (
        <View style={styles.channel}>
          <Meta style={styles.centered}>{t('review.done.channelHint')}</Meta>
          <Button
            title={
              channel.data?.channel_title
                ? t('review.done.visitNamed', { channel: channel.data.channel_title })
                : t('review.done.visit')
            }
            variant="secondary"
            onPress={() => Linking.openURL(url)}
          />
        </View>
      ) : null}

      <Button title={t('review.done.next')} onPress={() => router.replace('/review')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
    alignItems: 'stretch',
  },
  centered: {
    textAlign: 'center',
  },
  channel: {
    gap: space.sm,
    marginTop: space.sm,
  },
});
