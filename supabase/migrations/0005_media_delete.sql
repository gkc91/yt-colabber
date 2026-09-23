-- 0005 — kullanıcı kendi medya klasöründeki dosyayı silebilir (B2).
-- Gerek: submission sihirbazında yükleme iptal edilir ya da yarıda hata alırsa, yüklenmiş
-- dosyalar temizlenmeli; aksi halde kova sahipsiz dosya biriktirir.
-- Sınır insert/select ile aynı: yol `<klasör>/<auth.uid()>/...` olmalı.
create policy "media owner delete" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[2] = auth.uid()::text);
