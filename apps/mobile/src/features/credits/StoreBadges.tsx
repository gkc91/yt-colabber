// Mağaza rozetleri (web paywall'ı, 2026-09-30).
//
// NEDEN ROZET, DÜĞME DEĞİL: bağlantı yokken basılabilir bir şey göstermek, basınca hiçbir
// şey olmayan bir düğme demektir — bu oturumda web'de tam olarak öyle bir düğme bulundu ve
// tekrarlamanın anlamı yok. Bağlantısı olmayan mağaza bir `View`; ekran okuyucu onu düğme
// diye duyurmuyor, parmak da basacak bir şey aramıyor.
//
// Landing'deki `StoreButtons.astro` ile aynı davranış ve aynı metin biçimi
// ("App Store — Coming soon"): iki yüzey aynı şeyi söylemeli.
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Small } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { STORE_LINKS } from '@/constants/stores';
import { radius, space } from '@/design/tokens';
import { t } from '@/i18n';

export function StoreBadges() {
  const colors = Colors[useColorScheme()];

  const stores = [
    { key: 'android' as const, label: t('paywall.stores.android'), url: STORE_LINKS.android },
    { key: 'ios' as const, label: t('paywall.stores.ios'), url: STORE_LINKS.ios },
  ];

  return (
    <View style={styles.row}>
      {stores.map((store) =>
        store.url ? (
          <View key={store.key} style={styles.half}>
            <Button
              title={store.label}
              variant="secondary"
              onPress={() => Linking.openURL(store.url as string)}
            />
          </View>
        ) : (
          <View key={store.key} style={[styles.badge, styles.half, { borderColor: colors.border }]}>
            <Small tone="muted">{store.label}</Small>
            <Small tone="muted">{t('paywall.stores.comingSoon')}</Small>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  half: {
    flex: 1,
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.button,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    alignItems: 'center',
    gap: 2,
  },
});
