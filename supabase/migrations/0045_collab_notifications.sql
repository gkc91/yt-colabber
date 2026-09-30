-- 0045 — Collab bildirimleri (F3, PRODUCT §13: "yeni eşleşme, yeni mesaj").
--
-- 0011'in deseni korunuyor: tetikleyici KUYRUĞA yazar, `notify` Edge Function'ı kuyruğu
-- boşaltır. Gerekçe orada yazılı ve burada da geçerli — kural tarafı pgTAP ile sınanabilir
-- ve Expo'ya gönderim düşerse satır kuyrukta kalıp tekrar denenir.

alter type notification_kind add value if not exists 'collab_match';
alter type notification_kind add value if not exists 'collab_message';

-- ---------------------------------------------------------------- Yeni eşleşme
-- İKİ TARAFA da gidiyor: eşleşme karşılıklı beğeniyle doğuyor, yani ikinci beğeniyi yapan
-- kişi sonucu ekranda görüyor ama BİRİNCİ beğeniyi yapan kişi günler önce beğenmiş olabilir
-- ve haberi olmaz. Yalnızca ona göndermek de yanlış olurdu: ekranda kutlamayı gören kişi
-- uygulamayı kapatmış olabilir.
--
-- `after insert`, `after update` DEĞİL: `collab_like` çakışmada
-- `on conflict do update set created_at = created_at` yapıyor, yani aynı kişiyi tekrar
-- beğenmek satırı günceller. Insert tetikleyicisi o yolda çalışmaz ve bildirim
-- tekrarlanmaz.
create or replace function queue_collab_match_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (profile_id, kind, payload) values
    (new.a_id, 'collab_match', jsonb_build_object('match_id', new.id, 'partner_id', new.b_id)),
    (new.b_id, 'collab_match', jsonb_build_object('match_id', new.id, 'partner_id', new.a_id));
  return new;
end $$;

create trigger collab_matches_queue_notifications after insert on collab_matches
  for each row execute function queue_collab_match_notification();

-- ---------------------------------------------------------------- Yeni mesaj
create or replace function queue_collab_message_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_other uuid;
begin
  select case when m.a_id = new.sender_id then m.b_id else m.a_id end into v_other
    from collab_matches m where m.id = new.match_id;
  if v_other is null then return new; end if;

  -- Engellenmiş bir sohbete zaten yazılamıyor (0044), ama tetikleyici `send_message`
  -- dışındaki bir yoldan da çalışabilir; bildirim engelin arkasından sızmasın.
  if collab_blocked(new.sender_id, v_other) then return new; end if;

  -- SIKLIK SINIRI: aynı eşleşme için 15 dakikada bir. Sohbet hızlı gider ve her satır
  -- için bir push atmak, 20 mesajlık bir konuşmayı 20 bildirime çevirirdi — insanların
  -- bildirimleri kapatma sebebi tam olarak budur. İlk mesaj haber verir, gerisi zaten
  -- açık olan sohbette görünür.
  if exists (
    select 1 from notifications n
     where n.profile_id = v_other
       and n.kind = 'collab_message'
       and n.payload ->> 'match_id' = new.match_id::text
       and n.created_at > now() - interval '15 minutes'
  ) then return new; end if;

  insert into notifications (profile_id, kind, payload)
  values (v_other, 'collab_message',
          jsonb_build_object('match_id', new.match_id, 'sender_id', new.sender_id));
  return new;
end $$;

create trigger messages_queue_notifications after insert on messages
  for each row execute function queue_collab_message_notification();
