// Depoyu iki şeye karşı temizler (C5, 0040). Günlük cron çağırır: trigger_cleanup_clips.
//
//   1. Süresi dolmuş klipler — testi kapanmış ve saklama süresi geçmiş olanlar.
//   2. YETİM dosyalar — hiçbir teste bağlanmamış olanlar. Yükleme `create_submission`'dan
//      önce bittiği için, RPC'yi hiç çağırmayan biri depoyu bedavaya doldurabiliyordu ve
//      `expired_clips` yalnızca `submissions` satırlarına baktığı için onları hiç görmüyordu.
//      İkisi ayrı sorgu, çünkü yetimin silinecek bir satırı yok — yalnızca dosyası var.
//
// Yalnızca service_role çağırabilir — silme geri alınamaz bir iştir, kullanıcı JWT'siyle
// tetiklenebilir olmamalı.
//
// Sıra önemli: önce dosya silinir, sonra satır işaretlenir. Tersi olsaydı işaretlenmiş ama
// dosyası duran (bir daha hiç silinmeyecek) kayıtlar kalırdı. Bu sırada en kötü ihtimal
// aynı dosyayı bir kez daha silmeye çalışmaktır ki o zararsızdır.
import { admin, isInternalCall, json } from "../_shared/supabase.ts";

const BATCH = 100;

/**
 * Hiçbir teste bağlanmamış dosyaları siler ve kaç tane silindiğini döner.
 *
 * Hata FIRLATMIYOR: yetim temizliği bakım işi, asıl iş olan süresi dolmuş klip silmeyi
 * düşürmemeli. Sorun olursa sayı yerine mesaj dönüyor ve cron kaydında görünüyor.
 */
async function removeOrphans(sb: ReturnType<typeof admin>): Promise<number | string> {
  const { data, error } = await sb.rpc("orphan_media", { p_limit: BATCH });
  if (error) return error.message;

  const paths = ((data ?? []) as { path: string }[]).map((row) => row.path);
  if (paths.length === 0) return 0;

  const { error: removeError } = await sb.storage.from("media").remove(paths);
  return removeError ? removeError.message : paths.length;
}

Deno.serve(async (req) => {
  if (!isInternalCall(req)) return new Response("forbidden", { status: 403 });

  const sb = admin();
  const { data: expired, error } = await sb.rpc("expired_clips", { p_limit: BATCH });
  if (error) return json({ error: error.message }, 500);

  // Yetimler ÖNCE: eski hâlinde süresi dolmuş klip yoksa fonksiyon erken dönüyordu, yani
  // yetim temizliği hiç çalışmazdı. Havuz çoğu gün boş olacağı için bu sessiz bir hata olurdu.
  const orphans = await removeOrphans(sb);

  const rows = (expired ?? []) as { id: string; clip_path: string }[];
  if (rows.length === 0) return json({ ok: true, deleted: 0, orphans });

  const paths = rows.map((row) => row.clip_path);
  const { error: removeError } = await sb.storage.from("media").remove(paths);
  if (removeError) return json({ error: removeError.message }, 500);

  const { data: marked, error: markError } = await sb.rpc("mark_clips_deleted", {
    p_ids: rows.map((row) => row.id),
  });
  if (markError) return json({ error: markError.message }, 500);

  return json({ ok: true, deleted: marked, batch: rows.length, orphans });
});
