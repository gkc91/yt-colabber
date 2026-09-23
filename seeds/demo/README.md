# seeds/demo — örnek testler

Uygulamaya ilk giren kişi "Değerlendir" sekmesinde boş ekran görmesin diye yüklenen
testler. Sahte kullanıcı değil: hepsi `demo@clickable.app` hesabına ait, uygulamada
**"Örnek test"** rozetiyle gösterilir, kredi düşmez, kapanmaz ve sıralamada gerçek
testlerin arkasında durur (migration 0014).

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

    SUPABASE_URL=https://<ref>.supabase.co SERVICE_ROLE_KEY=<key> node scripts/seed-demo.mjs

Aynı başlık iki kez yüklenmez; dosyaları değiştirmeden tekrar çalıştırmak güvenlidir.
Medya dosyaları repoya konmaz (`.gitignore`), yalnızca `manifest.json` izlenir.
