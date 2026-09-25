// Hesap silme (C4). App Store, hesap silmeyi uygulama içinden zorunlu tutuyor.
// Silinen: auth kullanıcısı, profil ve ona bağlı satırlar (kendi testleri, kredi geçmişi,
// görevleri), Storage'daki kendi dosyaları.
// Silinmeyen: BAŞKALARININ testlerine yazdığı değerlendirmeler — kimliği düşer (reviewer_id
// null olur, 0013). Aksi halde o testlerin sonuçları ve sayaçları bozulurdu.
import { admin, json, preflight, userFromRequest } from "../_shared/supabase.ts";

const MEDIA_FOLDERS = ["thumbs", "clips"];

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const user = await userFromRequest(req);
    const sb = admin();

    // Storage'ı önce temizle: kullanıcı silinince yolu bilecek kimse kalmaz.
    for (const folder of MEDIA_FOLDERS) {
      const { data: files } = await sb.storage.from("media").list(`${folder}/${user.id}`);
      const paths = (files ?? []).map((file) => `${folder}/${user.id}/${file.name}`);
      if (paths.length > 0) await sb.storage.from("media").remove(paths);
    }

    const { error } = await sb.auth.admin.deleteUser(user.id);
    if (error) return json({ error: error.message }, 500);

    return json({ deleted: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
