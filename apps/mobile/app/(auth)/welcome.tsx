// Karşılama ekranı — uygulamayı açan kişinin gördüğü ilk şey (2026-09-29).
//
// NEDEN VAR: giriş ekranı doğrudan "e-postanı gir" diyordu. Uygulamanın ne yaptığını
// bilmeyen biri için bu, karşılığında ne alacağını bilmeden kimlik vermek demek. Burada
// önce vaat anlatılıyor, sonra "Start now" ile girişe geçiliyor.
//
// Metin PRODUCT.md §1'deki cümleden türetildi, pazarlama dili eklenmedi: üç adım ve kredi
// ekonomisi. KREDİ KISMI BİLEREK BURADA: uygulamanın en çok yanlış anlaşılan yanı o — para
// değil, değerlendirme vererek kazanılan bir sayaç (PRODUCT §9). Sonradan öğrenilmesi
// "ödeme duvarı" gibi hissettiriyor.
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Rule } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Display, Label, Small } from '@/components/Type';
import { space } from '@/design/tokens';
import { t } from '@/i18n';

function Step({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <View style={styles.step}>
      <Label>{String(index)}</Label>
      <View style={styles.stepText}>
        <Body>{title}</Body>
        <Small tone="muted">{body}</Small>
      </View>
    </View>
  );
}

export default function Welcome() {
  return (
    <Screen
      gap={space.xl}
      style={styles.page}
      footer={<Button title={t('welcome.start')} onPress={() => router.push('/sign-in')} />}
    >
      <View style={styles.header}>
        <Display>{t('welcome.title')}</Display>
        <Body tone="muted">{t('welcome.lede')}</Body>
      </View>

      <Rule />

      <View style={styles.steps}>
        <Step index={1} title={t('welcome.step1Title')} body={t('welcome.step1Body')} />
        <Step index={2} title={t('welcome.step2Title')} body={t('welcome.step2Body')} />
        <Step index={3} title={t('welcome.step3Title')} body={t('welcome.step3Body')} />
      </View>

      <Rule />

      <View style={styles.credits}>
        <Body>{t('welcome.creditsTitle')}</Body>
        <Small tone="muted">{t('welcome.creditsBody')}</Small>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: space.xxxl,
  },
  header: {
    gap: space.md,
  },
  steps: {
    gap: space.xl,
  },
  step: {
    flexDirection: 'row',
    gap: space.lg,
  },
  stepText: {
    flex: 1,
    gap: space.xs,
  },
  credits: {
    gap: space.xs,
  },
});
