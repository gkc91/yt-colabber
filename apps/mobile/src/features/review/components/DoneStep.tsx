import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { t } from '@/i18n';

import { fetchReviewedChannel } from '../api';

type Props = { submissionId: string };

/**
 * "+1 kredi" ekranı. Kanal bağlantısı YALNIZCA burada, yani değerlendirme gönderildikten
 * sonra görünür (PRODUCT §5): önce gösterilseydi değerlendirici kanalı tanır ve feed
 * testi "tanımayan birinin tepkisi" olmaktan çıkardı. Ziyaret sayılmaz, ödül değildir.
 */
export function DoneStep({ submissionId }: Props) {
  const colors = Colors[useColorScheme()];
  const channel = useQuery({
    queryKey: ['reviewed-channel', submissionId],
    queryFn: () => fetchReviewedChannel(submissionId),
  });

  const url = channel.data?.youtube_url;

  return (
    <View style={styles.container}>
      <Text style={styles.reward}>{t('review.done.reward')}</Text>
      <Text style={styles.body}>{t('review.done.body')}</Text>

      {url ? (
        <View style={styles.channel}>
          <Text style={[styles.channelHint, { color: colors.muted }]}>
            {t('review.done.channelHint')}
          </Text>
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
    gap: 16,
    alignItems: 'stretch',
  },
  reward: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  channel: {
    gap: 8,
    marginTop: 8,
  },
  channelHint: {
    fontSize: 14,
    textAlign: 'center',
  },
});
