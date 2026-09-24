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
