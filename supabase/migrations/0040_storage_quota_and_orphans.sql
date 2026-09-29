-- 0040 — kotasız yüklemeyi ve hiç silinmeyen yetim dosyaları kapat.
--
-- BULGU (2026-09-29): kaydolan bir hesap tek kredi harcamadan sınırsız dosya yükleyebiliyor
-- ve yüklediği hiçbir zaman silinmiyordu. Üç şey birlikte açığı oluşturuyordu:
--
--   (a) Storage INSERT politikası yalnızca "kendi klasörüne mi yazıyor" diye bakıyordu.
--       Dosya başına 8 MB ve MIME kısıtı vardı ama KAÇ dosya yazılacağına sınır yoktu.
--   (b) Yükleme `create_submission`'dan ÖNCE bitiyor (upload.ts bunu zaten yazıyor), yani
--       saldırgan RPC'yi hiç çağırmaz ve kredi hiç düşmez.
--   (c) `expired_clips` yalnızca `submissions` satırlarına bakıyor. Hiçbir teste bağlanmamış
--       dosyanın satırı yok, dolayısıyla temizlik onu hiç görmüyordu.
--
-- 125 yükleme = 1 GB, dakikalar sürer.
--
-- İKİ AYRI SAVUNMA, çünkü ikisi de tek başına yetmiyor:
--
--   Yetim temizliği sızıntıyı SINIRLI hale getiriyor: saldırgan yine yükleyebilir ama
--   biriktiremez, maliyet sabit kalır. Kota olmasa bile bu tek başına en büyük zararı alır.
--
--   Saatlik kota hacmi kesiyor. Dürüst kullanıcı bir testte en fazla 4 dosya yüklüyor
--   (3 thumbnail + 1 klip), yani 20'lik sınırı hissetmesi için aynı saat içinde beş test
--   açması gerekir.

/** Yüklenen dosyanın teste bağlanması için tanınan süre. */
create or replace function media_grace_hours() returns int
language sql immutable as $fn$ select 2 $fn$;

comment on function media_grace_hours is
  'Yükleme ile create_submission arasında tanınan süre. Bundan eskisi ve bağlanmamışsa yetimdir (0040).';

/** Kişi başı saatlik yükleme tavanı. */
create or replace function hourly_upload_limit() returns int
language sql immutable as $fn$ select 20 $fn$;

comment on function hourly_upload_limit is
  'Kişi başı bir saatte en fazla kaç dosya. Dürüst kullanıcı testte 4 yüklüyor (0040).';

/**
 * Hiçbir teste bağlanmamış ve tanınan süreyi geçmiş dosyalar.
 *
 * Süre payı ZORUNLU: yeni yüklenen bir dosya, `create_submission` çağrılana kadar teknik
 * olarak yetimdir. Payı kısa tutmak dürüst bir yüklemeyi silerdi — saniyeler değil saatler
 * ölçeğinde olmasının sebebi bu.
 */
create or replace function orphan_media(p_limit int default 100)
returns table (path text)
language sql security definer set search_path = public as $fn$
  select o.name
  from storage.objects o
  where o.bucket_id = 'media'
    and o.created_at < now() - make_interval(hours => media_grace_hours())
    and not exists (
      select 1 from submissions s
      where o.name = any(s.thumbnail_paths) or o.name = s.clip_path
    )
  order by o.created_at
  limit greatest(1, least(p_limit, 500));
$fn$;

revoke execute on function orphan_media(int) from public, anon, authenticated;

/**
 * Bu kişi son bir saatte kotasının altında mı.
 *
 * `security definer` çünkü politika çağıranın haklarıyla çalışıyor ve kullanıcının
 * `storage.objects` üzerinde sayım yapma yetkisi yok.
 */
create or replace function uploads_under_quota(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(p_uid is not null, false) and (
    select count(*) from storage.objects o
     where o.bucket_id = 'media'
       and (storage.foldername(o.name))[2] = p_uid::text
       and o.created_at > now() - interval '1 hour'
  ) < hourly_upload_limit();
$fn$;

grant execute on function uploads_under_quota(uuid) to authenticated;

-- İNDEKS EKLEYEMİYORUZ ve bunu bilerek kabul ediyoruz: `storage.objects` tablosunun sahibi
-- `supabase_storage_admin`, migration'lar `postgres` olarak çalışıyor ("must be owner of
-- table objects" — denendi). Politika oluşturmaya izin var, indekse yok.
--
-- Sonucu: kota sayımı `media` kovasındaki satırları tarıyor. Bugünkü hacimde önemsiz, ama
-- depo büyüdükçe her yüklemeye maliyet biner. Yavaşladığı gün çözüm, sayımı kendi
-- tablomuzda tutmak — `storage.objects`'e trigger da ekleyemeyeceğimiz için sayaç
-- `create_submission` ve yükleme yolundan beslenmeli.

-- ---------- politikayı kotayla değiştir ----------
drop policy if exists "media owner write" on storage.objects;

create policy "media owner write" on storage.objects for insert to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[2] = auth.uid()::text
  and uploads_under_quota(auth.uid())
);
