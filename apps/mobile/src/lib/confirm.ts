// Platformlar arası "emin misin?" (2026-09-30).
//
// NEDEN VAR: `Alert.alert` WEB'DE HİÇBİR ŞEY YAPMIYOR. React Native Web onu uygulamıyor —
// çağrı sessizce yutuluyor, hiçbir pencere çıkmıyor, `onPress` hiç çalışmıyor. Yani yalnızca
// `Alert.alert` kullanan bir onay akışı, app.clickabletest.com'da TAMAMEN ÖLÜ bir düğmedir.
// Collab'da "engelle" düğmesi tam olarak böyle yazılmıştı ve tarayıcı testinde yakalandı.
//
// Profil ekranındaki hesap silme akışı bunu zaten biliyordu ve satır içinde `Platform.OS`
// ayrımı yapıyordu; ikinci kopya çıkınca mantık buraya alındı.
//
// WEB'DE BAŞLIK DA GÖSTERİLİYOR: tarayıcının kendi penceresinde başlık alanı yok, bu yüzden
// metnin başına konuyor. Aksi hâlde "Bu geri alınamaz" gibi bir cümle neyin geri
// alınamadığını söylemeden çıkardı.
import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

export function confirmDestructive({
  title,
  message,
  confirmLabel,
  cancelLabel,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      // Sunucu tarafı render ya da pencere yok: onay ALINAMADI sayılır. Emin olmadığımızda
      // yıkıcı işlemi yapmayız.
      return Promise.resolve(false);
    }
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
