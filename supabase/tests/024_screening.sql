-- 024_screening.sql — yükleme anında tarama (0031, 0032).
--
-- Sorular: tarama açıkken test havuza GİRMEDEN bekliyor mu, taranmamış bir test
-- değerlendiriciye gidebiliyor mu (asıl mesele bu), temiz çıkınca açılıyor mu, takılırsa
-- kredi iade edilip sahibine haber gidiyor mu, tarama kapalıyken ürün çalışmaya devam
-- ediyor mu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------- arrange ----------
insert into niches (slug, name) values ('sc-niche', 'Screening niche');
insert into auth.users (id, email) values
  ('ee333333-0000-0000-0000-000000000001', 'sc-owner@test.local'),
  ('ee333333-0000-0000-0000-000000000002', 'sc-reviewer@test.local');

update profiles set niche_id = (select id from niches where slug='sc-niche'),
                    onboarding_done = true
 where id::text like 'ee333333-0000-0000-0000-00000000000_';

insert into channels (profile_id, youtube_url, niche_id)
values ('ee333333-0000-0000-0000-000000000001', 'https://www.youtube.com/@sc',
        (select id from niches where slug='sc-niche'));

-- İki test açacağız; kayıt bonusu (5) ilkine gidiyor.
insert into credit_ledger (profile_id, delta, reason)
values ('ee333333-0000-0000-0000-000000000001', 10, 'admin');

insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select (select id from niches where slug='sc-niche'), 'sc_decoy_'||g, 'Decoy '||g,
       'https://example.test/'||g||'.jpg'
from generate_series(1,5) g;

-- ---------- test_screening_is_off_without_a_key ----------
-- Anahtar yokken ürün çalışmaya devam etmeli; sessizce kapanmak değil, okunabilir cevap.
select ok(not screening_enabled(), 'anahtar yokken tarama kapalı');

set local request.jwt.claims to '{"sub":"ee333333-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select create_submission(array['A clean test title here'], array['thumbs/sc/a.jpg'],
  'clips/sc/a.mp4', 58, 5) as open_id \gset
reset role;

select is(
  (select status::text from submissions where id = :'open_id'),
  'open', 'tarama kapalıyken test doğrudan açılır');
select ok(
  (select screened_at is not null from submissions where id = :'open_id'),
  'kapalıyken screened_at doldurulur: "taranmadı" ile karışmasın');

-- ---------- test_screening_puts_a_new_test_in_the_queue ----------
-- Anahtarı gerçekten kuruyoruz: yoksa `create_submission`'ın tarama dalı hiç çalışmaz ve
-- test en önemli iddiayı sınamamış olur (mutasyon bunu yakaladı: dal kaldırıldığında
-- testler geçiyordu).
select vault.create_secret('test-vision-key', 'google_vision_api_key');
select ok(screening_enabled(), 'anahtar varken tarama açık');

set local request.jwt.claims to '{"sub":"ee333333-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select create_submission(array['A second test being screened'], array['thumbs/sc/b.jpg'],
  'clips/sc/b.mp4', 58, 5) as screened_id \gset
reset role;

select is(
  (select status::text from submissions where id = :'screened_id'),
  'screening', 'tarama açıkken yeni test havuza değil sıraya girer');

-- ---------- test_screening_holds_the_test_out_of_the_pool ----------
update submissions set status = 'screening', screened_at = null where id = :'open_id';

-- Hata bekleyemiyoruz: 0018'in çapraz-niş yedeği başka bir örnek test verebilir. Asıl
-- iddia, BİZİM taranmamış testimizin dağıtılmaması.
set local request.jwt.claims to '{"sub":"ee333333-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select lives_ok($$select next_review_task()$$, 'değerlendirici görev isteyebilir');
reset role;

select is(
  (select count(*)::int from review_tasks where submission_id = :'open_id'),
  0, 'taranmamış test hiç kimseye dağıtılmaz');

-- ---------- test_screening_passed_opens_it ----------
select screening_passed(:'open_id');
select is(
  (select status::text from submissions where id = :'open_id'),
  'open', 'temiz çıkan test açılır');
select ok(
  (select screened_at is not null from submissions where id = :'open_id'),
  'tarandığı an satırda duruyor');

-- ---------- test_screening_failed_refunds_and_tells_the_owner ----------
update submissions set status = 'screening', screened_at = null, requested_reviews = 5
 where id = :'open_id';
select screening_failed(:'open_id', 'inappropriate');

select is(
  (select status::text from submissions where id = :'open_id'),
  'hidden', 'takılan test gizlenir');
select is(
  (select count(*)::int from notifications
    where profile_id = 'ee333333-0000-0000-0000-000000000001' and kind = 'submission_hidden'),
  1, 'sahibine haber gider — itiraz edebilmesi için önce bilmesi lazım');

select * from finish();
rollback;
