// `signed_in` olayının NE ZAMAN gönderileceğine karar verir.
//
// Neden ayrı bir dosya: Supabase'in `onAuthStateChange` akışı tek bir açılışta birden
// fazla kez ateşleniyor — `INITIAL_SESSION`, ardından `SIGNED_IN`, sonra da arka plandan
// dönüşlerde `TOKEN_REFRESHED`. Hepsinde olay göndermek sayacı katlıyordu: 30 Eylül 2026'da
// PostHog'da her oturum için iki `signed_in` görüldü, yani "giriş yapan kişi" sayısı
// gerçeğin iki katı okunuyordu.
//
// Kural: olay, YALNIZCA aktif kullanıcı kimliği değiştiğinde gönderilir. Aynı kullanıcı
// için tekrar tekrar ateşlenen olaylar yutulur; çıkış yapıldığında hafıza sıfırlanır ki
// aynı kullanıcı tekrar girdiğinde yeniden sayılsın.

export interface SignInTracker {
  /** Yeni oturum durumu geldi. Olay gönderilmeli mi? */
  shouldCapture(userId: string | null): boolean;
}

export function createSignInTracker(): SignInTracker {
  let lastUserId: string | null = null;

  return {
    shouldCapture(userId) {
      if (!userId) {
        lastUserId = null;
        return false;
      }
      if (userId === lastUserId) return false;
      lastUserId = userId;
      return true;
    },
  };
}
