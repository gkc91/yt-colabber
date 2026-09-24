import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSession } from '@/features/auth/session';
import { useBalance } from '@/features/credits/api';
import {
  purchaseErrorKey,
  usePurchase,
  usePurchaseOptions,
  useRestore,
  type PurchaseOption,
} from '@/features/credits/purchaseApi';
import { track } from '@/lib/track';
import { t, type MessageKey } from '@/i18n';

export default function Paywall() {
  const { session } = useSession();
  const userId = session?.user.id;
  const colors = Colors[useColorScheme()];

  const balance = useBalance(userId);
  const options = usePurchaseOptions();
  const purchase = usePurchase(userId);
  const restore = useRestore(userId);

  useEffect(() => {
    track.capture('paywall_viewed');
  }, []);

  const loadErrorKey = options.error ? purchaseErrorKey(options.error) : null;
  // Web'de ve anahtar yokken satın alma hiç açılmaz: kullanıcıyı boş bir listeyle
  // baş başa bırakmak yerine nedenini söyleriz (PRODUCT §14).
  const unavailable = loadErrorKey === 'web_unsupported' || loadErrorKey === 'not_configured';
  const purchaseError = purchase.error ? purchaseErrorKey(purchase.error) : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          {t('paywall.balance', { count: balance.data ?? 0 })}
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>{t('paywall.earnInstead')}</Text>
      </View>

      {options.isPending ? <ActivityIndicator /> : null}

      {unavailable ? (
        <View style={[styles.card, { borderColor: colors.border }]}>
          <Text style={styles.cardTitle}>{t('paywall.unavailable.title')}</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            {t(`paywall.unavailable.${loadErrorKey}` as MessageKey)}
          </Text>
        </View>
      ) : null}

      {loadErrorKey && !unavailable ? (
        <View style={styles.section}>
          <Text style={[styles.body, { color: colors.danger }]}>{t('paywall.errors.load')}</Text>
          <Button
            title={t('paywall.retry')}
            variant="secondary"
            onPress={() => options.refetch()}
            loading={options.isFetching}
          />
        </View>
      ) : null}

      {(options.data ?? []).map((option) => (
        <OptionCard
          key={option.packageId}
          option={option}
          busy={purchase.isPending}
          onBuy={() => purchase.mutate(option)}
        />
      ))}

      {purchase.isSuccess ? (
        <Text style={styles.result}>
          {purchase.data.kind === 'pro'
            ? t('paywall.result.pro')
            : purchase.data.outcome === 'credited'
              ? t('paywall.result.credited', { balance: purchase.data.balance })
              : t('paywall.result.pending')}
        </Text>
      ) : null}

      {purchaseError ? (
        <Text style={[styles.body, { color: colors.danger }]}>
          {t(`paywall.errors.${purchaseError}` as MessageKey)}
        </Text>
      ) : null}

      {options.data?.length ? (
        <View style={styles.section}>
          <Button
            title={t('paywall.restore')}
            variant="secondary"
            onPress={() => restore.mutate()}
            loading={restore.isPending}
          />
          {restore.isSuccess ? (
            <Text style={[styles.body, { color: colors.muted }]}>
              {restore.data.proActive ? t('paywall.restored') : t('paywall.restoredNothing')}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Button title={t('paywall.close')} variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

function OptionCard({
  option,
  busy,
  onBuy,
}: {
  option: PurchaseOption;
  busy: boolean;
  onBuy: () => void;
}) {
  const colors = Colors[useColorScheme()];
  const pro = option.kind === 'pro';

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>
          {pro
            ? t(`paywall.options.${option.productId}` as MessageKey)
            : t('paywall.options.credits', { count: option.credits })}
        </Text>
        <Text style={styles.price}>{option.priceString}</Text>
      </View>
      <Text style={[styles.body, { color: colors.muted }]}>
        {pro
          ? t('paywall.options.proBody', { count: option.credits })
          : t('paywall.options.creditsBody')}
      </Text>
      <Button title={t('paywall.buy')} onPress={onBuy} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: 6,
  },
  section: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  price: {
    fontSize: 17,
    fontWeight: '600',
  },
  result: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
});
