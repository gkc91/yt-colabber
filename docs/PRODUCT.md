# PRODUCT.md — Ürün Spesifikasyonu

## 1. Tek cümle
Yayınlamadan önce videonun ilk izleniminin (thumbnail, başlık, ilk 60 sn) aynı nişteki gerçek insanlarda nasıl çalıştığını gör; karşılığında başkalarının videolarını değerlendir.

## 2. Kullanıcı
0–10k abone arası YouTube kanalı sahibi. Sorunu: video yayınlanınca CTR ve retention'ın neden düşük olduğunu anlamıyor; YouTube Test & Compare gösterim yetmediği için "net kazanan yok" diyor.

## 3. Roller
Her kullanıcı hem **talep sahibi** (submission açar) hem **değerlendirici**dir. Ayrı rol yok.

## 4. Ekranlar (expo-router)
```
app/
  (auth)/sign-in            magic link + Google
  (onboarding)/niche        niş seç (tek), dil seç
  (onboarding)/channel      YouTube kanal URL'i (zorunlu), abone aralığı (seçmeli)
  (tabs)/
    review/index            "Değerlendir" — sıradaki görev kartı, kredi bakiyesi üstte
    review/[taskId]         3 adımlı değerlendirme akışı
    submit/index            "Test et" — submission listem + yeni test butonu
    submit/new              yükleme sihirbazı (thumbnail'lar → başlıklar → klip → sayı → onay)
    submit/[id]             sonuç ekranı
    collab/index            eşleşme adayları (Faz F)
    collab/matches          eşleşmelerim + sohbet (Faz F)
    profile/index           kredi geçmişi, itibar, ayarlar, satın alma
  paywall                   modal
```

## 5. Değerlendirme akışı (çekirdek)
Bir görev = bir submission için tek değerlendirici. Üç adım, toplam hedef ≤3 dk.

**Adım 1 — Feed testi (thumbnail).** Aday thumbnail'lardan biri (submission'da 1–3 var; her değerlendiriciye rastgele biri) 5 gerçek niş videosuyla (cache) karıştırılır, YouTube ana sayfa görünümüne benzer 2 sütunlu ızgarada gösterilir. Soru: "Hangisine tıklardın?" Tek seçim. Kaydedilen: seçilen öğe (aday mı, decoy mu), adayın pozisyonu, karar süresi (ms).
> Aday thumbnail her zaman submission'daki başlıklardan rastgele biriyle gösterilir; böylece thumbnail×başlık kombinasyonu test edilir.

**Adım 2 — Vaat testi (başlık).** Aday thumbnail + başlık tek başına. Soru: "Bu video ne hakkında, bir cümleyle?" Serbest metin, ≥5 kelime.

**Adım 3 — Hook testi (klip).** Klip oynar (≤60 sn). Değerlendirici istediği an "Buradan çıkardım" der ya da sonuna kadar izler. Sebep etiketleri (çoklu, sabit): `slow_intro`, `unclear_promise`, `bad_audio`, `low_energy`, `too_long_setup`, `visual_quality`, `didnt_match_thumbnail`, `kept_watching`. İsteğe bağlı 1 satır yorum.
Kaydedilen: `leave_second` (null = sonuna kadar), `watched_seconds`, etiketler, yorum.

**Sunucu doğrulaması:** `leave_second ≤ watched_seconds`; `time_spent_seconds ≥ 20`; aynı submission ikinci kez değerlendirilemez; kendi submission'ı değerlendirilemez.

Tamamlanınca: +1 kredi (reputation ≥ 0.5 ise; altındaysa kredi yok, uyarı).

**Değerlendirme sonrası kanal bağlantısı.** "+1 kredi" ekranında test sahibinin kanalına giden isteğe bağlı bir bağlantı gösterilir ("Kanala göz at"). Kurallar: yalnızca değerlendirme GÖNDERİLDİKTEN sonra görünür (önce gösterilirse değerlendirici kanalı tanır ve feed/başlık testi "tanımayan biri"nin tepkisi olmaktan çıkar); krediyle ilişkisi yoktur; "abone ol" gibi bir çağrı kullanılmaz; ziyaret sayılmaz, ödüllendirilmez, raporlanmaz.

## 6. Submission akışı
1. Thumbnail'lar: 1–3 görsel, ≤2 MB (client 1280×720'ye yeniden boyutlandırır).
2. Başlıklar: 1–3 metin, ≤100 karakter.
3. Klip: galeriden video; client 720p/≤60 sn/≤8 MB'a sıkıştırır; uzunsa ilk 60 sn kesilir (kullanıcıya söylenir).
4. İstenen değerlendirme sayısı: 5 / 10 / 15 (= kredi maliyeti). Pro'da 25.
5. Onay: bakiye yetmiyorsa paywall.
Submission 72 saat açık kalır; sonunda gelen kadarıyla `completed`, kullanılmayan kredi iade (`refund`).

## 7. Sonuç ekranı
- Thumbnail başına: gösterim, seçilme oranı, ortalama karar süresi, kazanan rozeti (≥3 oy farkı).
- Başlık tahminleri listesi; talep sahibi "doğru anladı / yanlış anladı" işaretler (review_rating'e girer).
- Hook: 0–60 sn zaman çizgisinde ayrılma histogramı; medyan ayrılma saniyesi; sonuna kadar izleme oranı; etiket dağılımı.
- Yorumlar; her değerlendirmede "yararlı / değil" (itibarı besler).
- Pro: AI özeti (5 madde).

## 8. Kredi ekonomisi
- Kayıt +5 · Değerlendirme +1 (reputation ≥ 0.5) · Submission −N · Süre dolunca iade.
- IAP: `credits_10` / `credits_30` / `credits_100`. Pro aylık: 40 kredi + öncelikli kuyruk + 25'e kadar değerlendirici + AI özeti.

## 9. Politika sınırı (değişmez)
Uygulama YouTube üzerinde hiçbir etkileşim üretmez ve istemez. İzlenme/abone vaadi verilmez: YouTube'un sahte etkileşim politikası takas ve şişirme hizmetlerini yasaklar (uyarı → ihtar → kanal kapatma), uygulama içi izlemeler YouTube'da izlenme sayılmaz ve ilgisiz aboneler CTR/izlenme süresini düşürerek erişimi azaltır. Vaadimiz: yayın öncesi düzeltme ile **mevcut gösterimden daha fazla izlenme**. Kanal URL'i yalnızca niş/profil içindir. "Abone ol / izle / yorum yap" görevleri, karşılıklı tanıtım kredisi, izlenme/abone takası: **hiçbiri, hiçbir zaman.** Collab modülü yalnızca tanıştırır.

## 9.1 Örnek (demo) testler
Değerlendir sekmesi boş kalmasın diye resmî `demo@clickable.app` hesabına ait örnek testler bulunur.
Kurallar: arayüzde "Örnek test" rozetiyle ve "kimse bunu beklemiyor" açıklamasıyla gösterilir; kredi
ile açılmaz ve ledger'a dokunmaz; kapanmaz, iade üretmez; sıralamada gerçek testlerin arkasındadır;
değerlendirici normal +1 krediyi kazanır. İçeriği gerçek, yayınlanabilir bir ilk 60 saniye olmalıdır
(ilk kaynak kendi kanallarımız). Sahte değerlendirici hesabı YOKTUR: demo yalnızca test tarafındadır,
gerçek bir üreticinin testine sahte geri bildirim yazılmaz.

## 10. İtibar
`reputation` 0.2–2.0, başlangıç 1.0. Yararlı oyu +0.05, yararsız −0.1, reddedilen değerlendirme −0.2. Oy ağırlığı = reputation. 0.5 altı kredi kazanamaz; 0.3 altı görev alamaz.

## 11. Anti-fraud (MVP)
- `time_spent_seconds < 20` → reddet.
- Aynı cihaz kimliğiyle 3'ten fazla hesap → yeni hesap görev alamaz.
- Son 10 değerlendirmede hep aynı pozisyon / hep 0. sn çıkış → reputation −0.3, bayrak.
- 3 rapor alan submission gizlenir.

## 12. Collab modülü (Faz F)
- Profilde "Collab'a açığım" + türler: `joint_video`, `guest`, `shorts`, `end_screen_swap`, `live`.
- Adaylar: aynı niş + dil, abone bandı ±1, engellenmemiş, daha önce beğenilmemiş. Sıralama: (a) aralarında değerlendirme geçmişi olanlar önce, (b) itibar, (c) yenilik.
- Kart: kanal adı, band, türler, bio, "seni X kez değerlendirdi / sen onu Y kez".
- Kanal bağlantısı burada ve değerlendirme sonrası ekranında gösterilir (§5); hiçbir yerde krediyle ödüllendirilmez, görev haline getirilmez.
- Beğen → karşılıklıysa eşleşme → sohbet (Realtime). Engelle / rapor.
- Kredi yok, görev yok, YouTube aksiyonu yok.

## 13. Bildirimler
Push: yeni değerlendirme, test tamamlandı, görev bekliyor, yeni eşleşme, yeni mesaj. E-posta yalnızca magic link.

## 14. Web/PWA kapsamı
Web'de: giriş, değerlendirme, sonuç, profil **ve test açma**. Web'de YOK: satın alma (→ "uygulamada aç";
mağaza kuralı ve 20/B düzeni).

Test açmanın iki platformdaki farkı (2026-09-24'te değişti, DECISIONS):
- **Uygulama:** uzun video 60 saniyeye kesilir ve cihazda 720p'ye sıkıştırılır.
- **Web:** sıkıştırma YOK. Klip zaten ≤60 sn, ≤8 MB ve MP4/MOV olmalı; değilse kapıda reddedilir
  ve ne yapması gerektiği söylenir. Thumbnail'lar tarayıcıda 1280×720'ye indirilir.
Gerekçe: üreticiler kurguyu ve thumbnail'ı PC'de yapıyor; dosyayı telefona taşıtmak PC
kullanıcısını kaybettiriyor. Sunucu tarafı transcoding yine YOK.

## 15. Fiyat taslağı (RevenueCat ürün id'leri)
`credits_10` $2.99 · `credits_30` $6.99 · `credits_100` $17.99 · `pro_monthly` $6.99 · `pro_yearly` $49.99. Mağaza yerel fiyatları otomatik.
