# seeds/demo — örnek testler

Uygulamaya ilk giren kişi "Değerlendir" sekmesinde boş ekran görmesin diye yüklenen
testler. Sahte kullanıcı değil: hepsi `demo@clickable.app` hesabına ait, uygulamada
**"Örnek test"** rozetiyle gösterilir, kredi düşmez, kapanmaz ve sıralamada gerçek
testlerin arkasında durur (migration 0014).

## Kanallar

Örnek testler ortak `demo@clickable.app` hesabına ya da manifest'teki bir **kanala** ait
olur. Kanal hesabı gerçek bir kanalı temsil eder: değerlendirme bitince gösterilen
bağlantı o kanala gider (PRODUCT §5) ve kanal sahibi kendi sonuçlarını okuyabilir.

```json
{
  "channels": {
    "money-rematch": {
      "email": "moneyrematch@clickabletest.com",
      "handle": "moneyrematch",
      "display_name": "Money Rematch",
      "channel_title": "Money Rematch",
      "niche": "finance",
      "language": "en",
      "youtube_url": "https://www.youtube.com/@MoneyRematch"
    }
  },
  "submissions": [{ "channel": "money-rematch", "titles": ["..."], "thumbnails": ["a.jpg"], "clip": "a.mp4", "clip_duration_seconds": 58 }]
}
```

`youtube_url` isteğe bağlıdır; yoksa bitiş ekranında kanal düğmesi hiç görünmez.
Kanal bilgileri her çalıştırmada güncellenir, testler ise başlığa bakılarak bir kez eklenir.

## Ne koyulur

Gerçek, izlenebilir bir ilk 60 saniye. İlk kaynak kendi kanallarımız:
Somebody Had To Do It, Let Me Finish, finans kanalı, çocuk kanalı.

Koymadığımız şey: kimsenin çekmediği, kimsenin yayınlamayacağı üretilmiş "video".
Değerlendirici buna en az 20 saniyesini veriyor; karşılığında gerçek bir ilk 60 saniye
olmalı. Thumbnail üretilmiş olabilir (zaten test edilen şey o), klip olmamalı.

## Dosya düzeni

    seeds/demo/
      manifest.json
      shtdi-garage.jpg
      shtdi-garage-b.jpg
      shtdi-garage.mp4

`manifest.json`:

```json
{
  "submissions": [
    {
      "niche": "diy",
      "language": "en",
      "titles": ["I fixed the thing nobody wanted to fix", "The worst repair job I have taken"],
      "thumbnails": ["shtdi-garage.jpg", "shtdi-garage-b.jpg"],
      "clip": "shtdi-garage.mp4",
      "clip_duration_seconds": 58
    }
  ]
}
```

- `niche`: `niches.slug` (animation, gaming, education, tech, finance, fitness, vlog,
  food, music, diy, science, comedy, travel, kids).
- `titles` ve `thumbnails`: 1-3 tane; her değerlendiriciye bir kombinasyon gösterilir.
- `clip`: 720p, ≤60 sn, ≤8 MB mp4 (uygulamadaki sıkıştırmanın çıktısıyla aynı hedef).

## Yükleme

    node scripts/seed-demo.mjs          # yerel stack
    node scripts/seed-demo.mjs --list   # yüklü örnek testler

Staging/prod için:

    node scripts/seed-demo.mjs --linked   # bağlı proje; anahtarı terminalde sorar

Aynı başlık iki kez yüklenmez; dosyaları değiştirmeden tekrar çalıştırmak güvenlidir.
Medya dosyaları repoya konmaz (`.gitignore`), yalnızca `manifest.json` izlenir.
