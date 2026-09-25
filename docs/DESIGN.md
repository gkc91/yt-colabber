# DESIGN.md — Arayüz sözleşmesi

> Bu belge "güzel olsun" demez; neyin neden öyle olduğunu ve neyin yasak olduğunu söyler.
> Ekran yazan herkes (insan ya da model) buna uyar. Ürün kararları PRODUCT.md'de.

## 1. Tek cümlelik fikir

**Clickable bir araç değil, sana gerçeği söyleyen bir rapordur.**
Kullanıcı buraya övgü almaya gelmiyor; yayından önce neyin çalışmadığını öğrenmeye geliyor.
Arayüz de öyle konuşur: sakin bir kâğıt zemin, keskin siyah metin, kahraman olan **sayılar**,
ve yalnızca gerektiğinde beliren tek bir kırmızı.

## 2. Değişmez kural: test yüzeyi tasarlanmaz

Değerlendirme akışının **feed adımı** (`FeedStep`) mümkün olduğunca **YouTube'un kendi
görünümüne yakın** kalır: iki sütun ızgara, düz köşeler, gerçek video başlıkları, kanal adı,
süslemesiz.

Gerekçe ürünseldir, estetik değil: insan orada yarım saniyede seçim yapıyor ve biz o seçimin
**YouTube'daki davranışı temsil ettiğini** iddia ediyoruz. Izgarayı güzelleştirirsek —
yuvarlak köşeler, gölgeler, markalı vurgular — ölçtüğümüz şey artık YouTube değil, bizim
arayüzümüz olur. Test geçerliliği tasarımdan önce gelir.

Karakter, testin **dışındaki** ekranlarda kurulur: sonuçlar, profil, kredi, boş ve hata durumları.

## 3. Renk

Landing (`clickabletest.com`) ile aynı palet — marka tek parça olsun.

| Rol | Açık | Koyu | Ne için |
|---|---|---|---|
| `paper` | `#FAF9F7` | `#0F1115` | Sayfa zemini |
| `surface` | `#FFFFFF` | `#171A20` | Kart, panel |
| `ink` | `#16161A` | `#F2F4F7` | Ana metin, büyük sayılar |
| `muted` | `#6B6862` | `#A3ABB8` | İkincil metin, etiket |
| `line` | `#E6E2DC` | `#262B33` | Saç teli çizgiler |
| `accent` | `#D92D20` | `#FF5A4D` | Birincil eylem, kazanan rozeti, uyarı |
| `positive` | `#1F7A4C` | `#4ADE80` | "İşe yarıyor" göstergesi |

Kurallar:
- **Vurgu rengi ekranda en fazla bir yerde** görünür. Her şey kırmızıysa hiçbir şey kırmızı değildir.
- Gölge yok. Katmanı **saç teli çizgi** (1px `line`) ve zemin farkı taşır.
- Gradyan yok, cam efekti yok, emoji yok.

## 4. Tipografi

- **Başlıklar ve sayılar:** Archivo (SIL OFL) — 600/700. Sıkı harf aralığı (`-0.02em` etkisi).
- **Gövde:** sistem fontu. Hızlı açılır, her platformda okunur.
- Ölçek (dp): 40 / 28 / 20 / 17 / 15 / 13. Aradaki değerler uydurulmaz.
- Sayılar **büyük ve tabular**: "%73" bir başlıktan daha büyük olabilir — rapor hissi buradan gelir.
- Metin satır uzunluğu 640 dp'yi geçmez; geniş ekranda içerik ortalanır, yayılmaz.

## 5. Boşluk ve biçim

- Boşluk ölçeği: **4, 8, 12, 16, 24, 32, 48**. Ara değer yok.
- Köşe yarıçapı: kartlarda `12`, düğmelerde `10`, rozetlerde `999`. Başka değer yok.
- Dokunma hedefi en az **44 dp**.
- Ekran çerçevesi: `maxWidth 640`, yatayda ortalanmış, kenar boşluğu 20.

## 6. Yasaklılar listesi ("AI çıktısı" görünümünün sebepleri)

1. Expo/şablon varsayılan mavisi (`#2f95dc`) — kaldırıldı, geri gelmez.
2. Her kartın aynı gri çerçeve + aynı gölge + aynı yuvarlaklıkla dizilmesi.
3. Her şeyin dikey ortalanması; hiyerarşisiz, hepsi aynı puntoda metin.
4. Mor/mavi gradyan, cam efekti, emoji ikon.
5. "Empower your content journey" tarzı içi boş metin. Metin somut ve kısa olur.
6. Boş durumda yalnızca "Nothing here" demek — boş durum ne yapılacağını söyler.

## 7. Durumlar

Her ekran dört durumu da tanımlar: **yükleniyor, boş, hata, dolu.**
- Yükleniyor: iskelet değil, sade bir gösterge — ekranlarımız küçük.
- Boş: bir cümle neden boş + bir eylem.
- Hata: ne oldu, ne kaybedildi (çoğu zaman hiçbir şey), ne yapılmalı.

## 8. Hareket

Hareket yalnızca **anlam taşıyorsa** vardır: sonucun ortaya çıkışı, kredinin artışı.
Dekoratif animasyon yok. Süre 150-200 ms, `ease-out`.

## 9. Uygulama ikonu

Dört thumbnail, biri seçilmiş (sağ üst, `accent`). Ürünün sorusu bu: **hangisine tıklanır?**
Kâğıt zemin, `ink` kartlar, tek kırmızı — uygulamanın içiyle aynı dil.

- Tek kaynak: `node scripts/make-icons.mjs`. Uygulama ikonu, Android uyarlanabilir ikon
  (ön plan/zemin/monokrom), açılış işareti, favicon ve mağaza ikonu oradan üretilir.
  Elle düzeltilmiş bir PNG kimse tarafından güncellenemez; renk değişirse script çalıştırılır.
- Ölçüt **48 px**: ana ekranda ikon o boyutta görünür. Denenip elenen tasarım (tek kart +
  imleç) küçükken siyah bir kutuya dönüşüyordu.
- Monokrom sürümde seçili kart tam opak, diğerleri %35 — hiyerarşi tek renkte de duruyor.

## 10. Bileşen kataloğu

Ekran yazan kişi burada tanımlı olanı kullanır; yeni bir şey uyduracaksa önce buraya yazar.
Sebep: ilkeler (renk, tip, boşluk) tek başına yetmiyor — düğmenin yüksekliği ya da girdinin
odak durumu yazılı değilse her yeni ekranda yeniden icat ediliyor ve arayüz dağılıyor.
Değerler `src/design/tokens.ts` adlarıyla yazılır, ham sayıyla değil.

| Bileşen | Tanım |
|---|---|
| `Button` (primary) | Dolgu `tint`, yazı `onTint`, `radius.button`, yükseklik en az `minTouch + xs`, yatay iç boşluk `lg`, yazı 16 / `fonts.heading`. Basılıyken ve pasifken %60 saydam. Yükleniyorsa yazı yerine gösterge. |
| `Button` (secondary) | Zemin yok, saç teli çerçeve `line`, yazı `ink`. Ölçüler primary ile aynı. |
| `Chip` | Seçili: dolgu `ink`, yazı `paper`. Seçili değil: `surface` zemin + saç teli çerçeve. `radius.pill`, iç boşluk `lg × sm`. **Kırmızı değil** — profilde beş seçili niş sayfayı kırmızıya boğuyordu. |
| `TextField` | Etiket `Meta` büyük harf; alan `surface` zemin, `radius.button`, en az `minTouch + xs` yükseklik, gövde punto. Odakta çerçeve 2px `ink`, hatada 2px `accent` + altında `Small` hata metni. |
| `Card` | `surface` zemin, saç teli `line` çerçeve, `radius.card`, iç boşluk `lg`. Gölge yok. |
| `Rule` | Saç teli yatay çizgi. Başlık ile içerik arasını ayırır. |
| `Section` | `Heading` + sağında isteğe bağlı sessiz `Meta` sayaç + `Rule` + içerik. Rapor ritmi bu üçlüden çıkar. |
| `Screen` | Sayfa çerçevesi: `paper` zemin, `maxWidth 640`, kenar boşluğu `gutter`, üstte `xl` altta `xxxl`. `center` türevi boş/hata ekranları için. |
| `Stat` | Büyük tabular sayı (`display`) + altında büyük harf `Meta` etiket. Sonuç ekranlarının kahramanı. |
| `Progress` | 3px yüksekliğinde çubuk; dolu kısım `ink`, tamamlandıysa `positive`, zemin `line`. Sayının yanında durur, onun yerine geçmez. |
| `StudioSidebar` | Geniş ekranda sol menü: marka, kimlik (baş harf + ad + niş), bölümler, altta kredi. Seçili bölüm `tint` renkli ve `fonts.heading`. |

## 11. Ekran genişliği

| Genişlik | Davranış |
|---|---|
| < 900 dp | Alt sekme çubuğu (telefon). İçerik tek sütun, `maxWidth 640` ile ortalanır. |
| ≥ 900 dp | Alt sekmeler yerine 248 dp sol menü (`StudioSidebar`). İçerik yine 640 dp ile sınırlı. |

- Dokunma hedefi her yerde en az 44 dp; `Button` ve `TextField` bunu `minTouch + xs` ile alır.
- Uzun metin 640 dp'yi geçmez. Geniş ekranda sütun büyümez, boşluk büyür.

## 12. Yazılı olmayanlar

Dürüst liste — buraya yazılmamış olan şey kararlaştırılmamıştır, bir sonraki ekranı yazan
uydurmak yerine buraya ekler:

- Hareket: süre ve eğri (§8 yalnızca "ne zaman" diyor, "nasıl" demiyor).
- Boş durum illüstrasyonu: yok, olmayacak da — boş ekran metinle konuşur.
- Bildirim/uyarı şeridi (toast) biçimi: henüz hiç kullanılmadı.
- Tablo: gelmedi. Geldiğinde satır yüksekliği ve hizalama burada tanımlanır.

