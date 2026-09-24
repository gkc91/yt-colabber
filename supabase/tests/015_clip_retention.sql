-- 015_clip_retention.sql — kapanan testin klibinin silinmesi (0017, C5).
-- Sorular: hangi test "süresi dolmuş" sayılıyor, açık test yanlışlıkla giriyor mu,
-- iki kez işaretleniyor mu, kullanıcı bu fonksiyonları çağırabiliyor mu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ---------- arrange ----------
insert into niches (slug, name) values ('retention-niche', 'Retention Niche');
insert into auth.users (id, email) values
  ('cccc7777-0000-0000-0000-000000000001', 'retention-owner@test.local');
update profiles set niche_id = (select id from niches where slug='retention-niche'), onboarding_done = true
  where id = 'cccc7777-0000-0000-0000-000000000001';

-- eski ve kapanmış (silinmeli)
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews, status, closes_at)
values ('dddd8888-0000-0000-0000-00000000000a', 'cccc7777-0000-0000-0000-000000000001',
        (select id from niches where slug='retention-niche'), array['Old title'],
        array['thumbs/o/1.jpg'], 'clips/o/old.mp4', 30, 5, 'completed',
        now() - interval '40 days');

-- kapanmış ama yeni (silinmemeli)
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews, status, closes_at)
values ('dddd8888-0000-0000-0000-00000000000b', 'cccc7777-0000-0000-0000-000000000001',
        (select id from niches where slug='retention-niche'), array['Recent title'],
        array['thumbs/r/1.jpg'], 'clips/r/recent.mp4', 30, 5, 'completed',
        now() - interval '10 days');

-- hâlâ açık ama closes_at geçmişte (cron kapatmadan önce) — silinmemeli
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews, status, closes_at)
values ('dddd8888-0000-0000-0000-00000000000c', 'cccc7777-0000-0000-0000-000000000001',
        (select id from niches where slug='retention-niche'), array['Open title'],
        array['thumbs/p/1.jpg'], 'clips/p/open.mp4', 30, 5, 'open',
        now() - interval '40 days');

-- ---------- test_expired_clips_picks_only_old_closed_tests ----------
select is(
  (select count(*)::int from expired_clips(100)
    where id = 'dddd8888-0000-0000-0000-00000000000a'),
  1, '40 günlük kapalı test listeye girer');

select is(
  (select count(*)::int from expired_clips(100)
    where id = 'dddd8888-0000-0000-0000-00000000000b'),
  0, '10 günlük kapalı test listeye girmez');

select is(
  (select count(*)::int from expired_clips(100)
    where id = 'dddd8888-0000-0000-0000-00000000000c'),
  0, 'hâlâ açık test listeye girmez');

select is(
  (select clip_path from expired_clips(100) where id = 'dddd8888-0000-0000-0000-00000000000a'),
  'clips/o/old.mp4', 'silinecek dosyanın yolu döner');

-- ---------- test_mark_clips_deleted_is_idempotent ----------
select is(
  mark_clips_deleted(array['dddd8888-0000-0000-0000-00000000000a']::uuid[]),
  1, 'işaretleme bir satır günceller');

select isnt(
  (select clip_deleted_at from submissions where id = 'dddd8888-0000-0000-0000-00000000000a'),
  null, 'silinme zamanı yazılır');

select is(
  mark_clips_deleted(array['dddd8888-0000-0000-0000-00000000000a']::uuid[]),
  0, 'ikinci çağrı aynı satırı tekrar işaretlemez');

select is(
  (select count(*)::int from expired_clips(100)
    where id = 'dddd8888-0000-0000-0000-00000000000a'),
  0, 'silinmiş klip listeye bir daha girmez');

-- ---------- test_cleanup_functions_are_service_role_only ----------
select ok(
  not has_function_privilege('authenticated', 'expired_clips(int)', 'execute')
  and not has_function_privilege('authenticated', 'mark_clips_deleted(uuid[])', 'execute')
  and not has_function_privilege('authenticated', 'trigger_cleanup_clips()', 'execute'),
  'temizlik fonksiyonlarını kullanıcı çağıramaz');

select * from finish();
rollback;
