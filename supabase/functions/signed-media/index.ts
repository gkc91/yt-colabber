// Görev sahibi (reviewer) veya submission sahibi için 60 dk signed URL üretir.
// Yetki kararı burada DEĞİL, Postgres'teki media_paths() fonksiyonundadır (0004, pgTAP ile test edilir).
// Bu fonksiyon yalnızca o kararı uygular ve imzalar.
import { admin, json, preflight, userClient } from "../_shared/supabase.ts";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// media_paths()'in fırlattığı hatalar → HTTP durumları
const STATUS: Record<string, number> = {
  not_authenticated: 401,
  no_access: 403,
  task_expired: 403,
  submission_closed: 403,
  invalid_arguments: 400,
};

type MediaPaths = { role: "reviewer" | "owner"; thumbnails: string[]; clip: string };

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { task_id = null, submission_id = null } = await req.json().catch(() => ({}));

    const { data, error } = await userClient(req).rpc("media_paths", {
      p_task_id: task_id,
      p_submission_id: submission_id,
    });
    if (error) {
      const code = (error.message.match(/[a-z_]+$/)?.[0] ?? "") as string;
      return json({ error: code || "no_access" }, STATUS[code] ?? 403);
    }

    const paths = data as MediaPaths;
    const { data: signed, error: signError } = await admin()
      .storage.from("media")
      .createSignedUrls([...paths.thumbnails, paths.clip], SIGNED_URL_TTL_SECONDS);
    if (signError) return json({ error: signError.message }, 500);

    // Göreli yol döneriz: yerelde imza URL'i Docker içi host'u (kong) taşır ve dışarıdan
    // çözülemez. Client kendi Supabase adresiyle birleştirir; her ortamda doğru olur.
    const relative = (url: string) => {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search;
    };
    const byPath = Object.fromEntries(signed.map((s) => [s.path, relative(s.signedUrl)]));
    return json({
      role: paths.role,
      thumbnails: paths.thumbnails.map((p) => byPath[p]),
      clip: byPath[paths.clip],
      expires_in: SIGNED_URL_TTL_SECONDS,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
