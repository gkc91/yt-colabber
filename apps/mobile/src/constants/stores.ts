// Mağaza bağlantıları (E3'te doldurulacak).
//
// AYNI DEĞER LANDING'DE DE VAR: `apps/landing/src/data/site.ts` → `STORE`. İkisi ayrı
// uygulama ve aralarında paylaşılan bir paket yok; E3'te link geldiğinde İKİSİ BİRDEN
// güncellenmeli, yoksa site "indir" derken uygulama "yakında" der.
//
// `null` iken rozet gösterilir, bağlantı değil: ölü bir link kullanıcıyı boşuna yorar.
export const STORE_LINKS: { ios: string | null; android: string | null } = {
  ios: null,
  android: null,
};
