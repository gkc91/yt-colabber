// RevenueCat'in bildirdiği ürün kimliğini bizim katalog kimliğimize indirger.
//
// NEDEN (2026-09-29): Play'in yeni tek seferlik ürün modelinde her ürünün altında bir
// "satın alma seçeneği" var (bizde `buy`), aboneliklerde ise "temel plan". RevenueCat
// bazı durumlarda kimliği `<ürün>:<seçenek>` biçiminde bildiriyor.
//
// Bizim eşlememiz BİREBİR eşitlik kullanıyordu: `credits_10:buy` gelseydi `CREDITS`
// tablosunda karşılığı bulunamaz, olay "etkisiz" sayılır ve kullanıcı parasını ödediği
// hâlde kredisini ALAMAZDI — üstelik webhook 200 döndüğü için RevenueCat tekrar denemez
// ve hata hiçbir yerde görünmezdi. Sessizce para yiyen bir hata.
//
// Ürün oluştururken Play "Eski sürümlerle uyumlu" rozeti gösterdi, yani düz `credits_10`
// da bildirilebilir. İki biçimden hangisinin geleceğini gerçek bir satın alma olmadan
// doğrulayamıyoruz; bu yüzden kod ikisini de kabul ediyor. Varsayıma değil, gözleme
// dayanana kadar tolerans doğru cevap.

/** `credits_10:buy` → `credits_10`. Ayraç yoksa kimlik olduğu gibi döner. */
export function baseProductId(productId: string): string {
  return productId.split(":")[0];
}
