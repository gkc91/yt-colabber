-- seed.sql — yerel geliştirme verisi. `supabase db reset` sonrası çalışır.
-- niş sorguları (B3 için)
update niches set queries = array['stickman animation','animated short film','2d animation story'] where slug='animation';
update niches set queries = array['indie game review','minecraft build','gameplay commentary'] where slug='gaming';
update niches set queries = array['explained simply','how does it work','history explained'] where slug='education';

-- placeholder decoy'lar (her niş 12 satır) — gerçek veri B3 fonksiyonuyla gelir
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url, channel_title, view_count)
select n.id, 'seed_'||n.slug||'_'||g, 'Sample video '||g||' in '||n.name,
       'https://picsum.photos/seed/'||n.slug||g||'/640/360', 'Channel '||g, 5000 + g*1000
from niches n cross join generate_series(1,12) g on conflict do nothing;
