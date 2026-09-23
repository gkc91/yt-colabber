-- 007_fraud.sql — anti-fraud kuralları (PRODUCT §11, 0010).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------- arrange ----------
insert into niches (slug, name) values ('fraud-niche', 'Fraud test niche');
insert into auth.users (id, email) values
  ('dddd1111-0000-0000-0000-000000000001', 'fraud-owner@test.local'),
  ('dddd1111-0000-0000-0000-000000000002', 'fraud-bot@test.local'),
  ('dddd1111-0000-0000-0000-000000000003', 'fraud-zero@test.local'),
  ('dddd1111-0000-0000-0000-000000000004', 'fraud-human@test.local');
update profiles set niche_id = (select id from niches where slug='fraud-niche'), onboarding_done = true
  where id::text like 'dddd1111-0000-0000-0000-00000000000_';

-- 12 submission: her değerlendirici 10'ar değerlendirme yapabilsin
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
select ('eeee1111-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
       'dddd1111-0000-0000-0000-000000000001',
       (select id from niches where slug='fraud-niche'),
       array['A title'], array['thumbs/f/1.jpg'], 'clips/f/1.mp4', 30, 25
from generate_series(1, 12) g;

-- Değerlendirme yazan yardımcı: görev açar, süreyi geri alır, submit_review çağırır.
create function pg_temp.do_review(p_reviewer uuid, p_submission uuid, p_position int, p_leave int)
returns uuid language plpgsql as $$
declare v_task review_tasks%rowtype; v_review uuid;
begin
  insert into review_tasks (submission_id, reviewer_id, thumbnail_index, title_index, decoys, candidate_position,
                            assigned_at)
  values (p_submission, p_reviewer, 0, 0, '[]'::jsonb, 0, now() - interval '60 seconds')
  returning * into v_task;

  perform set_config('request.jwt.claims', json_build_object('sub', p_reviewer, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_review := submit_review(v_task.id, true, p_position, 1500, 'A guess about this video', p_leave,
                            coalesce(p_leave, 20), array['slow_intro'], null, 45);
  execute 'reset role';
  return v_review;
end $$;

-- ---------- test_fraud_same_position_ten_times_is_flagged ----------
select is((select is_flagged from profiles where id='dddd1111-0000-0000-0000-000000000002'), false,
  'başlangıçta bayrak yok');

-- 9 değerlendirme: henüz karar verilmemeli (az veriyle suçlama yok)
select pg_temp.do_review('dddd1111-0000-0000-0000-000000000002',
  ('eeee1111-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid, 3, 5)
from generate_series(1, 9) g;

select is((select is_flagged from profiles where id='dddd1111-0000-0000-0000-000000000002'), false,
  '9 değerlendirmede bayrak yok (10 dolmadan karar verilmez)');
select is((select reputation from profiles where id='dddd1111-0000-0000-0000-000000000002'), 1.00::numeric(4,2),
  '9 değerlendirmede itibar el değmemiş');

-- 10. değerlendirme aynı pozisyonda → bayrak
select pg_temp.do_review('dddd1111-0000-0000-0000-000000000002',
  'eeee1111-0000-0000-0000-000000000010'::uuid, 3, 5);

select is((select is_flagged from profiles where id='dddd1111-0000-0000-0000-000000000002'), true,
  '10 değerlendirme boyunca aynı pozisyon → bayrak');
select is((select flagged_reason from profiles where id='dddd1111-0000-0000-0000-000000000002'), 'same_position_10',
  'bayrağın nedeni kaydedilir');
select is((select reputation from profiles where id='dddd1111-0000-0000-0000-000000000002'), 0.70::numeric(4,2),
  'itibar 0.3 düşer (1.00 → 0.70)');

-- ---------- test_fraud_flagged_reviewer_cannot_take_tasks ----------
set local request.jwt.claims to '{"sub":"dddd1111-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select next_review_task()$$,
  'reviewer_blocked', 'bayraklı kullanıcı yeni görev alamaz');
reset role;

-- ---------- test_fraud_always_leaving_at_zero_is_flagged ----------
select pg_temp.do_review('dddd1111-0000-0000-0000-000000000003',
  ('eeee1111-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid, (g % 6), 0)
from generate_series(1, 10) g;

select is((select flagged_reason from profiles where id='dddd1111-0000-0000-0000-000000000003'), 'always_left_at_zero',
  'her seferinde 0. saniyede çıkmak → bayrak');

-- ---------- test_fraud_varied_behaviour_is_not_flagged ----------
select pg_temp.do_review('dddd1111-0000-0000-0000-000000000004',
  ('eeee1111-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid, (g % 6), (g * 3))
from generate_series(1, 10) g;

select is((select is_flagged from profiles where id='dddd1111-0000-0000-0000-000000000004'), false,
  'değişken davranış bayraklanmaz (yanlış pozitif yok)');
select is((select reputation from profiles where id='dddd1111-0000-0000-0000-000000000004'), 1.00::numeric(4,2),
  'dürüst değerlendiricinin itibarı korunur');

-- ---------- test_fraud_device_limit_flags_extra_accounts ----------
-- Aynı cihazdan 3'ten fazla hesap → yeni hesap bayraklanır (PRODUCT §11)
reset role;
update profiles set device_ids = array['device-xyz']
  where id in ('dddd1111-0000-0000-0000-000000000001','dddd1111-0000-0000-0000-000000000002',
               'dddd1111-0000-0000-0000-000000000003');
set local request.jwt.claims to '{"sub":"dddd1111-0000-0000-0000-000000000004","role":"authenticated"}';
set local role authenticated;
do $$ begin perform register_device('device-xyz'); end $$;
reset role;
select is((select is_flagged from profiles where id='dddd1111-0000-0000-0000-000000000004'), true,
  'aynı cihazda 3 hesap varken 4. hesap bayraklanır');

select * from finish();
rollback;
