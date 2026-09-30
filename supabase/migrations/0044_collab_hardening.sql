-- 0044 — Collab: engelleme gerçekten engellesin, "geç" kalıcı olsun, sohbet okunabilsin.
--
-- 0002 modülün iskeletini kurmuştu ama ekranı hiç yazılmadı. F2'ye başlarken SQL okununca
-- dört açık çıktı ve dördü de ekran yazılmadan kapanmalı, çünkü hepsi ekranın davranışını
-- belirliyor:
--
--   1. "Geç" diye bir şey YOKTU. `collab_candidates` yalnızca BEĞENDİKLERİNİ eliyordu,
--      yani geçtiğin kişi bir sonraki açılışta yine karşına çıkardı.
--   2. `collab_like` ve `send_message` `blocks` tablosuna HİÇ bakmıyordu. Engellediğin
--      kişi seni beğenip eşleşme kurabiliyor ve mesaj atmaya devam edebiliyordu — yani
--      engelleme yalnızca aday listesinde işe yarıyordu, asıl gerektiği yerde değil.
--   3. `profiles` "yalnızca kendini oku" politikasında (0001). Eşleştiğin kişinin ADINI
--      bile okuyamıyorsun; sohbet listesi bu yüzden `security definer` bir fonksiyon
--      olmak zorunda.
--   4. Mesajda hız sınırı ve rapor yolu yoktu (F4).
--
-- Kredi bağlantısı yok ve olmayacak (CLAUDE.md kırmızı çizgi): bu dosyada `credit_ledger`
-- geçmiyor.

-- ---------------------------------------------------------------- 1. "Geç"
-- Ayrı tablo, `collab_likes`'a bir sütun değil: beğeni ile geçmek farklı ömürlere sahip.
-- Beğeni karşılıklı olursa eşleşmeye dönüşür ve kalıcıdır; geçmek yalnızca "bunu bir daha
-- gösterme" demektir ve ileride süre dolumu eklemek isteyebiliriz.
create table collab_passes (
  from_id uuid not null references profiles(id) on delete cascade,
  to_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
alter table collab_passes enable row level security;
create policy "passes self" on collab_passes for all
  using (auth.uid() = from_id) with check (auth.uid() = from_id);

-- ---------------------------------------------------------------- 2. Engel yardımcısı
-- İKİ YÖNLÜ: engelleyen de engellenen de birbirini görmemeli. Tek yönlü olsaydı
-- engellediğin kişi seni görmeye devam ederdi ve engelleme yarım bir söz olurdu.
-- `security definer`, çünkü `blocks` politikası yalnızca KENDİ engellerini gösteriyor;
-- karşı tarafın seni engelleyip engellemediğini normal yoldan göremezsin.
create or replace function collab_blocked(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
     where (blocker_id = p_a and blocked_id = p_b)
        or (blocker_id = p_b and blocked_id = p_a)
  );
$$;
revoke execute on function collab_blocked from public, anon;
grant execute on function collab_blocked to authenticated;

-- ---------------------------------------------------------------- 3. Adaylar
-- Geçilenler de eleniyor. Ayrıca 0002'den beri duran ve fonksiyonu ÇALIŞMAZ kılan bir
-- hata düzeltildi: sıralama `order by (reviewed_me + i_reviewed) desc` yazıyordu ve
-- Postgres çıktı takma adını ORDER BY'da TEK BAŞINA kabul eder, bir İFADENİN İÇİNDE
-- etmez — her çağrı `column "reviewed_me" does not exist` ile düşüyordu. Ekran hiç
-- yazılmadığı ve testi olmadığı için bugüne kadar kimse çağırmamış. Sıralama artık
-- kendi katmanında: limit doğru satırlara uygulansın diye içeride, JSON dizisinin sırası
-- garanti olsun diye `jsonb_agg` içinde de.
create or replace function collab_candidates(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_me profiles%rowtype; v_band int;
begin
  select * into v_me from profiles where id = v_uid;
  if not exists (select 1 from collab_profiles where profile_id = v_uid and is_open) then
    raise exception 'collab_closed';
  end if;
  select coalesce(array_position(enum_range(null::subscriber_band), c.band), 3) into v_band
    from channels c where c.profile_id = v_uid;
  return (
    select coalesce(
      jsonb_agg(row_to_json(x)
        order by (x.reviewed_me + x.i_reviewed) desc, x.reputation desc, x.updated_at desc),
      '[]')
    from (
      select * from (
        select p.id, p.display_name, c.channel_title, c.youtube_url, c.band, cp.types, cp.bio,
               p.reputation, cp.updated_at,
               (select count(*) from reviews r join submissions s on s.id = r.submission_id
                 where r.reviewer_id = p.id and s.owner_id = v_uid) as reviewed_me,
               (select count(*) from reviews r join submissions s on s.id = r.submission_id
                 where r.reviewer_id = v_uid and s.owner_id = p.id) as i_reviewed
        from profiles p
        join collab_profiles cp on cp.profile_id = p.id and cp.is_open
        join channels c on c.profile_id = p.id
        where p.id <> v_uid and p.niche_id = v_me.niche_id and p.language = v_me.language
          and not p.is_flagged
          and abs(coalesce(array_position(enum_range(null::subscriber_band), c.band), 3) - v_band) <= 1
          and not collab_blocked(v_uid, p.id)
          and not exists (select 1 from collab_likes l where l.from_id = v_uid and l.to_id = p.id)
          and not exists (select 1 from collab_passes s2 where s2.from_id = v_uid and s2.to_id = p.id)
      ) inner_rows
      order by (inner_rows.reviewed_me + inner_rows.i_reviewed) desc,
               inner_rows.reputation desc, inner_rows.updated_at desc
      limit p_limit
    ) x
  );
end $$;

-- ---------------------------------------------------------------- 4. Beğen / geç / engelle
-- Beğeni artık engeli kontrol ediyor. Normalde engellenen kişi aday listesinde zaten
-- görünmüyor, ama iki ekran arasında geçen sürede engel konabilir; listedeki eski kart
-- hâlâ tıklanabilir. Kontrol sunucuda olmazsa engelleme o pencerede delinir.
create or replace function collab_like(p_to uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_match uuid;
begin
  if p_to = v_uid then raise exception 'self'; end if;
  if collab_blocked(v_uid, p_to) then raise exception 'blocked'; end if;

  insert into collab_likes (from_id, to_id) values (v_uid, p_to) on conflict do nothing;
  -- Beğenmek "geçtim"i geri alır: fikir değiştirmek serbest.
  delete from collab_passes where from_id = v_uid and to_id = p_to;

  if exists (select 1 from collab_likes where from_id = p_to and to_id = v_uid) then
    insert into collab_matches (a_id, b_id) values (least(v_uid, p_to), greatest(v_uid, p_to))
    on conflict (a_id, b_id) do update set created_at = collab_matches.created_at
    returning id into v_match;
  end if;
  return v_match;
end $$;

create or replace function collab_pass(p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if p_to = v_uid then raise exception 'self'; end if;
  insert into collab_passes (from_id, to_id) values (v_uid, p_to) on conflict do nothing;
end $$;

-- Engelle: kaydı yaz ve KARŞILIKLI beğenileri sil. Eşleşme satırı SİLİNMİYOR, yalnızca
-- gizleniyor (aşağıdaki politikalar) — silinseydi mesaj geçmişi de gider ve bir raporu
-- inceleyecek hiçbir kayıt kalmazdı.
create or replace function collab_block(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if p_target = v_uid then raise exception 'self'; end if;
  insert into blocks (blocker_id, blocked_id) values (v_uid, p_target) on conflict do nothing;
  delete from collab_likes
   where (from_id = v_uid and to_id = p_target) or (from_id = p_target and to_id = v_uid);
end $$;

-- ---------------------------------------------------------------- 5. Eşleşme listesi
-- Okundu bilgisi: sohbet listesi "yeni mesaj var mı" diyebilsin diye. Ayrı tablo, çünkü
-- `collab_matches` iki kişinin ORTAK satırı ve okundu bilgisi kişiye özeldir.
create table collab_match_reads (
  match_id uuid not null references collab_matches(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (match_id, profile_id)
);
alter table collab_match_reads enable row level security;
create policy "reads self" on collab_match_reads for all
  using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- `security definer` ZORUNLU: karşı tarafın adı ve kanalı `profiles`/`channels` içinde ve
-- ikisi de "yalnızca kendini oku" politikasında. Bu fonksiyon yalnızca EŞLEŞTİĞİN kişinin
-- ve yalnızca kartta gösterilen alanlarını veriyor — e-posta, jeton, itibar dışı hiçbir şey.
create or replace function collab_matches_list() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  return (select coalesce(jsonb_agg(row_to_json(x) order by x.last_message_at desc nulls last), '[]')
    from (
      select m.id,
             other.id as partner_id,
             other.display_name,
             c.channel_title,
             c.youtube_url,
             c.band,
             cp.types,
             m.created_at,
             (select body from messages msg where msg.match_id = m.id
               order by msg.created_at desc limit 1) as last_message,
             (select msg.created_at from messages msg where msg.match_id = m.id
               order by msg.created_at desc limit 1) as last_message_at,
             (select count(*) from messages msg
               where msg.match_id = m.id
                 and msg.sender_id <> v_uid
                 and msg.created_at > coalesce(
                       (select r.last_read_at from collab_match_reads r
                         where r.match_id = m.id and r.profile_id = v_uid),
                       '-infinity'::timestamptz)) as unread
      from collab_matches m
      join profiles other on other.id = case when m.a_id = v_uid then m.b_id else m.a_id end
      left join lateral (
        select ch.channel_title, ch.youtube_url, ch.band from channels ch
         where ch.profile_id = other.id order by ch.created_at limit 1
      ) c on true
      left join collab_profiles cp on cp.profile_id = other.id
      where v_uid in (m.a_id, m.b_id)
        and not collab_blocked(m.a_id, m.b_id)
    ) x);
end $$;

create or replace function collab_mark_read(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from collab_matches m where m.id = p_match and v_uid in (m.a_id, m.b_id))
  then raise exception 'not_in_match'; end if;
  insert into collab_match_reads (match_id, profile_id, last_read_at)
  values (p_match, v_uid, now())
  on conflict (match_id, profile_id) do update set last_read_at = now();
end $$;

-- ---------------------------------------------------------------- 6. Mesaj
/**
 * Günlük sınır. Ekran bunu okuyup "bugünlük bu kadar" diyebilsin diye fonksiyon; ama
 * TESTLER bu fonksiyonu KULLANMAZ, sabit sayı yazar. 0040'ın dersi: sınırı sınadığı
 * fonksiyondan türeten bir test, sınır kaldırıldığında kendisi de uyum sağlayıp geçer.
 */
create or replace function collab_message_limit() returns int language sql immutable as $$ select 100 $$;

create or replace function send_message(p_match uuid, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id bigint; v_a uuid; v_b uuid; v_sent int;
begin
  select m.a_id, m.b_id into v_a, v_b from collab_matches m
   where m.id = p_match and v_uid in (m.a_id, m.b_id);
  if v_a is null then raise exception 'not_in_match'; end if;
  -- Engellenmiş bir eşleşmeye yazılamaz. Eşleşme satırı duruyor (geçmiş kaybolmasın) ama
  -- sohbet kapalı; bu kontrol olmasaydı engelleme yalnızca listeyi gizlerdi.
  if collab_blocked(v_a, v_b) then raise exception 'blocked'; end if;

  select count(*) into v_sent from messages
   where sender_id = v_uid and created_at > now() - interval '24 hours';
  if v_sent >= collab_message_limit() then raise exception 'daily_limit'; end if;

  insert into messages (match_id, sender_id, body) values (p_match, v_uid, p_body)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- 7. Rapor (F4)
create table message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id bigint not null references messages(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);
alter table message_reports enable row level security;
create policy "message reports self read" on message_reports for select
  using (auth.uid() = reporter_id);

-- Kendi mesajını raporlayamazsın ve yalnızca içinde olduğun sohbeti raporlayabilirsin.
create or replace function report_message(p_message bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_sender uuid;
begin
  select msg.sender_id into v_sender
    from messages msg join collab_matches m on m.id = msg.match_id
   where msg.id = p_message and v_uid in (m.a_id, m.b_id);
  if v_sender is null then raise exception 'not_in_match'; end if;
  if v_sender = v_uid then raise exception 'own_message'; end if;
  insert into message_reports (message_id, reporter_id, reason)
  values (p_message, v_uid, p_reason)
  on conflict (message_id, reporter_id) do nothing;
end $$;

-- ---------------------------------------------------------------- 8. Politikalar
-- Engellenen eşleşme listede de, doğrudan sorguda da görünmez. `collab_blocked`
-- `security definer` olduğu için karşı tarafın koyduğu engeli de görebiliyor.
drop policy "matches member" on collab_matches;
create policy "matches member" on collab_matches for select
  using (auth.uid() in (a_id, b_id) and not collab_blocked(a_id, b_id));

-- Mesaj politikası eşleşmeye join'liyor; engeli AYRICA burada da kontrol ediyoruz çünkü
-- politikanın içindeki alt sorgu, `collab_matches`'in kendi politikasını uygulamaz.
drop policy "messages member" on messages;
create policy "messages member" on messages for select
  using (exists (
    select 1 from collab_matches m
     where m.id = match_id
       and auth.uid() in (m.a_id, m.b_id)
       and not collab_blocked(m.a_id, m.b_id)
  ));

revoke execute on function collab_pass, collab_block, collab_matches_list, collab_mark_read,
  report_message from public, anon;
grant execute on function collab_pass, collab_block, collab_matches_list, collab_mark_read,
  report_message, collab_message_limit to authenticated;
