// Hak senkronu (0043). Sunucuya "beni RevenueCat'e sor" der; cevabı sunucu yazar.
//
// NEDEN VAR. Webhook kalıcı olarak kaybolabilir. Kaybolursa kullanıcı ödediği hâlde Pro
// açılmaz ve 40 kredisi yazılmaz. Bu çağrı o yolun telafisi ve iki yerden yapılıyor:
// uygulama açılışında (oturum kurulunca) ve "satın almaları geri yükle"ye basılınca.
//
// İSTEMCİ BURADA HİÇBİR ŞEY İDDİA ETMİYOR. Gövde boş: profil kimliği bile gönderilmiyor,
// sunucu onu JWT'den çözüyor. Gönderseydik bir kullanıcı başkasının kimliğini yazıp onun
// hakkını değiştirebilirdi. Durumu RevenueCat'e sunucu soruyor (CLAUDE.md kırmızı çizgi).
//
// SESSİZ BAŞARISIZLIK BİLİNÇLİ: bu bir onarım yolu, ana yol değil. Ağ yoksa ya da
// RevenueCat cevap vermiyorsa kullanıcıya hata göstermenin bir anlamı yok — yapabileceği
// bir şey yok ve bir sonraki açılışta yeniden denenecek. Ana yolda (satın alma) hata
// zaten gösteriliyor.
import { supabase } from '@/lib/supabase';

export interface EntitlementSync {
  pro: boolean;
  /** RevenueCat bu kullanıcıyı tanıyor mu (hiç satın alma yapmamışsa false). */
  known: boolean;
  /** RevenueCat'in bildiği ama bizde karşılığı olmayan tek seferlik satın alma sayısı. */
  creditsUnseen: number;
}

export async function syncEntitlements(): Promise<EntitlementSync | null> {
  const { data, error } = await supabase.functions.invoke<EntitlementSync>('sync-entitlements', {
    body: {},
  });
  if (error || !data) return null;
  return data;
}
