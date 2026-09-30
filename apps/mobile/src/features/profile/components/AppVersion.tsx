// Sürüm künyesi (profil, hesap bölümünün altında).
//
// NEDEN: kapalı testte "hangi sürümde gördün?" sorusunun cevabı olmadan gelen her rapor
// tahmine dönüşüyor. Testçi bu satırı okuyup yazabilirse bir hatanın hangi build'de
// olduğu tartışmasız hâle geliyor.
//
// ÜÇ PARÇA, ÜÇÜ DE AYRI İŞE YARIYOR:
//   sürüm     — mağazada görünen numara (app.json `version`)
//   build     — mağazaya yüklenen paketin numarası (EAS her build'de artırıyor)
//   güncelleme— OTA güncellemesinin kimliği; aynı build'in iki farklı içeriği olabilir
//               ve hangisinin çalıştığını yalnızca bu ayırt eder.
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { StyleSheet } from 'react-native';

import { Meta } from '@/components/Type';
import { space } from '@/design/tokens';
import { t } from '@/i18n';

export function AppVersion() {
  // Yerel sürüm yalnızca gerçek bir pakette var; web'de ve dev istemcisinde yapılandırmadaki
  // sürüme düşüyoruz. Yoksa ekranda "Sürüm — (—)" gibi bozuk bir satır çıkıyordu.
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—';
  const build = Application.nativeBuildVersion;
  // Geliştirme sunucusunda OTA kimliği yok; o zaman kısaltma da göstermiyoruz.
  const update = Updates.updateId ? Updates.updateId.slice(0, 8) : null;

  const text =
    build && update
      ? t('profile.account.versionWithUpdate', { version, build, update })
      : build
        ? t('profile.account.version', { version, build })
        : t('profile.account.versionOnly', { version });

  return (
    <Meta style={styles.line} selectable>
      {text}
    </Meta>
  );
}

const styles = StyleSheet.create({
  line: {
    marginTop: space.sm,
  },
});
