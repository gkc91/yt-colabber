-- seed.sql — yerel geliştirme verisi. `supabase db reset` sonrası çalışır. Prod'a gitmez.

-- niş sorguları (B3 için)
update niches set queries = array['stickman animation','animated short film','2d animation story'] where slug='animation';
update niches set queries = array['indie game review','minecraft build','gameplay commentary'] where slug='gaming';
update niches set queries = array['explained simply','how does it work','history explained'] where slug='education';

-- placeholder decoy'lar (her niş 10 satır) — gerçek veri B3 fonksiyonuyla gelir
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url, channel_title, view_count)
select n.id, 'seed_'||n.slug||'_'||g, 'Sample video '||g||' in '||n.name,
       'https://picsum.photos/seed/'||n.slug||g||'/640/360', 'Channel '||g, 5000 + g*1000
from niches n cross join generate_series(1,10) g on conflict do nothing;

-- 3 test kullanıcısı, animation nişi. Giriş: <ad>@clickable.test / password123
-- auth.users insert → handle_new_user trigger'ı profil + 5 kredi signup bonus açar.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('password123', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), now(), now(),
       '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'alice@clickable.test', 'Alice'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'bob@clickable.test',   'Bob'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'cara@clickable.test',  'Cara')
) as u(id, email, name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u where u.email like '%@clickable.test';

update profiles p set
  niche_id = (select id from niches where slug = 'animation'),
  handle = lower(p.display_name),
  onboarding_done = true
where p.id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');

insert into channels (profile_id, youtube_url, channel_title, band) values
  ('11111111-1111-1111-1111-111111111111', 'https://www.youtube.com/@alice-animates', 'Alice Animates', 'b100_1k'),
  ('22222222-2222-2222-2222-222222222222', 'https://www.youtube.com/@bob-draws',      'Bob Draws',      'b0_100'),
  ('33333333-3333-3333-3333-333333333333', 'https://www.youtube.com/@cara-frames',    'Cara Frames',    'b1k_10k');
