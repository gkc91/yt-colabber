import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Heading, Small, Title } from '@/components/Type';
import { space } from '@/design/tokens';
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
    <Screen gap={space.lg}>
      <View style={styles.header}>
        <Title>{t('paywall.title')}</Title>
        <Small tone="muted">{t('paywall.balance', { count: balance.data ?? 0 })}</Small>
        <Small tone="muted">{t('paywall.earnInstead')}</Small>
      </View>

      {options.isPending ? <ActivityIndicator /> : null}

      {unavailable ? (
        <Card>
          <Heading>{t('paywall.unavailable.title')}</Heading>
          <Small tone="muted">{t(`paywall.unavailable.${loadErrorKey}` as MessageKey)}</Small>
        </Card>
      ) : null}

      {loadErrorKey && !unavailable ? (
        <View style={styles.section}>
          <Small tone="accent">{t('paywall.errors.load')}</Small>
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
        <Body style={styles.result}>
          {purchase.data.kind === 'pro'
            ? t('paywall.result.pro')
            : purchase.data.outcome === 'credited'
              ? t('paywall.result.credited', { balance: purchase.data.balance })
              : t('paywall.result.pending')}
        </Body>
      ) : null}

      {purchaseError ? (
        <Small tone="accent">{t(`paywall.errors.${purchaseError}` as MessageKey)}</Small>
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
            <Small tone="muted">
              {restore.data.proActive ? t('paywall.restored') : t('paywall.restoredNothing')}
            </Small>
          ) : null}
        </View>
      ) : null}

      <Button title={t('paywall.close')} variant="secondary" onPress={() => router.back()} />
    </Screen>
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
  const pro = option.kind === 'pro';

  return (
    <Card>
      <View style={styles.cardHead}>
        <Heading style={styles.cardTitle}>
          {pro
            ? t(`paywall.options.${option.productId}` as MessageKey)
            : t('paywall.options.credits', { count: option.credits })}
        </Heading>
        {/* Fiyat mağazadan gelir; rakam hizalı dursun. */}
        <Heading style={styles.price}>{option.priceString}</Heading>
      </View>
      <Small tone="muted">
        {pro
          ? t('paywall.options.proBody', { count: option.credits })
          : t('paywall.options.creditsBody')}
      </Small>
      <Button title={t('paywall.buy')} onPress={onBuy} disabled={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space.sm,
  },
  section: {
    gap: space.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
  },
  cardTitle: {
    flexShrink: 1,
  },
  price: {
    fontVariant: ['tabular-nums'],
  },
  result: {
    fontWeight: '600',
  },
});
