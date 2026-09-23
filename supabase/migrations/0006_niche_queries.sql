-- 0006 — niş arama sorguları + günlük cache yenileme (B3).
-- Sorgular migration'da (seed'de değil): staging ve prod'da da gerekli.
-- Decoy'lar küçük-orta kanallardan gelmeli; sorgular bu yüzden niş diline yakın,
-- marka/haber ağırlıklı olmayan ifadeler.

update niches set queries = case slug
  when 'animation'  then array['stickman animation','animated short film','2d animation story']
  when 'gaming'     then array['indie game review','minecraft build tutorial','gameplay commentary']
  when 'education'  then array['explained simply','how does it work','history explained']
  when 'tech'       then array['app tutorial','budget laptop review','coding project build']
  when 'finance'    then array['personal finance tips','investing for beginners','budgeting explained']
  when 'fitness'    then array['home workout routine','beginner gym guide','healthy meal prep']
  when 'vlog'       then array['day in my life vlog','moving apartment vlog','weekly vlog routine']
  when 'food'       then array['easy dinner recipe','baking at home','street food cooking']
  when 'music'      then array['original song cover','music production tutorial','bedroom studio setup']
  when 'diy'        then array['diy home project','woodworking beginner','craft ideas tutorial']
  when 'science'    then array['science experiment explained','space facts video','biology explained']
  when 'comedy'     then array['comedy sketch','funny short film','improv sketch']
  when 'travel'     then array['solo travel vlog','budget travel guide','city walking tour']
  when 'kids'       then array['kids craft activity','family day out','learning video for kids']
  when 'other'      then array['how to guide','beginner tutorial','my first video']
  else queries end
where is_active;

-- pg_net: cron işinin Edge Function'ı çağırabilmesi için
create extension if not exists pg_net with schema extensions;

-- Cron'un çağıracağı yardımcı. URL ve service role key Vault'ta tutulur (migration'da sır yok):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- Sır yoksa iş sessizce atlanır; yerelde fonksiyon elle çağrılır.
create or replace function trigger_refresh_niche_cache() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'refresh-niche-cache atlandı: project_url / service_role_key Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/refresh-niche-cache',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end $$;

revoke execute on function trigger_refresh_niche_cache from public, anon, authenticated;

select cron.schedule('refresh_niche_cache', '0 4 * * *', $$select trigger_refresh_niche_cache()$$);
