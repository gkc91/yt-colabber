import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Heading, Small, Title } from '@/components/Type';
import { layout, space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import { useBalance } from '@/features/credits/api';
import { StoreBadges } from '@/features/credits/StoreBadges';
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
        <Card gap={space.md}>
          <Heading>{t('paywall.unavailable.title')}</Heading>
          <Small tone="muted">{t(`paywall.unavailable.${loadErrorKey}` as MessageKey)}</Small>
          {/*
            Mağaza rozetleri yalnızca web'de: `not_configured` bir GELİŞTİRME durumu
            (anahtarsız build) ve oradaki kullanıcıya mağazayı göstermek yanlış cevap.
          */}
          {loadErrorKey === 'web_unsupported' ? <StoreBadges /> : null}
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

      {/* Mağazalar satın alma ekranında şartlara ve gizliliğe erişim istiyor. */}
      {/*
        Dokunma alanı (2026-09-30, ölçüldü: bu iki bağlantı 21 dp yüksekliğindeydi, alt
        sınır 44). `hitSlop` DEĞİL gerçek dolgu: React Native Web `hitSlop`'u hiç
        uygulamıyor, yani yalnızca onunla büyütülen bir hedef app.clickabletest.com'da
        küçük kalırdı. Dolgu iki yüzeyde de çalışıyor.
      */}
      <View style={styles.legal}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('paywall.legal.terms')}
          style={styles.legalLink}
          onPress={() => Linking.openURL('https://clickabletest.com/terms')}
        >
          <Small tone="muted">{t('paywall.legal.terms')}</Small>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('paywall.legal.privacy')}
          style={styles.legalLink}
          onPress={() => Linking.openURL('https://clickabletest.com/privacy')}
        >
          <Small tone="muted">{t('paywall.legal.privacy')}</Small>
        </Pressable>
      </View>

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
      {/* Abonelikte yenilenme koşulu satın alma düğmesinin YANINDA durmak zorunda:
          Apple 3.1.2 ve Play abonelik politikası bunu istiyor, California'nın otomatik
          yenileme yasası (B&P §17603) açıklanmamış yenilemeyi iade sebebi sayıyor. */}
      {pro ? (
        <Small tone="muted">
          {t(
            option.productId === 'pro_yearly'
              ? 'paywall.renewal.yearly'
              : 'paywall.renewal.monthly',
          )}{' '}
          {t('paywall.renewal.cancel')}
        </Small>
      ) : null}
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
  legalLink: {
    minHeight: layout.minTouch,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xl,
  },
  price: {
    fontVariant: ['tabular-nums'],
  },
  result: {
    fontWeight: '600',
  },
});
