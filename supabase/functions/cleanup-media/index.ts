// Süresi dolmuş klipleri depodan siler (C5). Günlük cron çağırır: trigger_cleanup_clips.
//
// Yalnızca service_role çağırabilir — silme geri alınamaz bir iştir, kullanıcı JWT'siyle
// tetiklenebilir olmamalı.
//
// Sıra önemli: önce dosya silinir, sonra satır işaretlenir. Tersi olsaydı işaretlenmiş ama
// dosyası duran (bir daha hiç silinmeyecek) kayıtlar kalırdı. Bu sırada en kötü ihtimal
// aynı dosyayı bir kez daha silmeye çalışmaktır ki o zararsızdır.
import { admin, json } from "../_shared/supabase.ts";

const BATCH = 100;

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "service_key_missing" }, 500);
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return new Response("forbidden", { status: 403 });
  }

  const sb = admin();
  const { data: expired, error } = await sb.rpc("expired_clips", { p_limit: BATCH });
  if (error) return json({ error: error.message }, 500);

  const rows = (expired ?? []) as { id: string; clip_path: string }[];
  if (rows.length === 0) return json({ ok: true, deleted: 0 });

  const paths = rows.map((row) => row.clip_path);
  const { error: removeError } = await sb.storage.from("media").remove(paths);
  if (removeError) return json({ error: removeError.message }, 500);

  const { data: marked, error: markError } = await sb.rpc("mark_clips_deleted", {
    p_ids: rows.map((row) => row.id),
  });
  if (markError) return json({ error: markError.message }, 500);

  return json({ ok: true, deleted: marked, batch: rows.length });
});
