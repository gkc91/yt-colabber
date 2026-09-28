// Yüklenen testin thumbnail'larını Google Cloud Vision SafeSearch'ten geçirir (0032).
//
// Neden: rapor akışı zararı ONARIYOR, girmesini engellemiyordu — zararlı bir içeriği en az
// bir kişinin görmesi gerekiyordu ve o kişi kredi karşılığı iki dakika bakmak zorundaydı.
// Meta'nın işlem yaptığı içeriğin %90'dan fazlası kimse şikâyet etmeden yakalanıyor;
// bizdeki oran sıfırdı.
//
// Yalnızca service_role çağırabilir. Sırayı boşaltır: `screening` durumundaki testleri alır,
// karar verir, `screening_passed` / `screening_failed` çağırır.
//
// Görüntü Vision'a BAYT olarak gidiyor, imzalı adres olarak değil: depo özel ve Vision'ın
// oradan çekebilmesi için adresin dışarı açılması gerekirdi. Bayt göndermek o soruyu
// tamamen ortadan kaldırıyor.
import { admin, json } from "../_shared/supabase.ts";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const BATCH = 10;
const MAX_ATTEMPTS = 3;

// SafeSearch beş kademe döner: VERY_UNLIKELY … VERY_LIKELY. Eşiği LIKELY'de tutuyoruz.
// POSSIBLE'da tutmak yanlış pozitifleri çoğaltırdı: thumbnail'lar abartılı yüz ifadeleri ve
// parlak renklerle dolu, "possible violence" çok kolay tetikleniyor. Yanlış pozitifin
// bedelini iyi niyetli kanal ödüyor ve itiraz sırasını tıkıyor.
const BLOCK: Record<string, string> = {
  adult: "inappropriate",
  racy: "inappropriate",
  violence: "inappropriate",
};
const BLOCKING_LEVELS = new Set(["LIKELY", "VERY_LIKELY"]);

type Row = { id: string; thumbnail_paths: string[]; screen_attempts: number };

async function safeSearch(key: string, images: Uint8Array[]) {
  const body = {
    requests: images.map((bytes) => ({
      image: { content: btoa(String.fromCharCode(...bytes)) },
      features: [{ type: "SAFE_SEARCH_DETECTION" }],
    })),
  };
  const response = await fetch(`${VISION_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error?.message ?? "vision_error");
  return (parsed.responses ?? []) as Array<{
    safeSearchAnnotation?: Record<string, string>;
    error?: { message?: string };
  }>;
}

/** İlk engelleyen sinyalin sebebi; hiçbiri engellemiyorsa null. */
function verdict(annotation: Record<string, string> | undefined): string | null {
  if (!annotation) return null;
  for (const [field, reason] of Object.entries(BLOCK)) {
    if (BLOCKING_LEVELS.has(annotation[field] ?? "")) return reason;
  }
  return null;
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "service_key_missing" }, 500);
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return new Response("forbidden", { status: 403 });
  }

  const visionKey = Deno.env.get("GOOGLE_VISION_API_KEY");
  if (!visionKey) return json({ error: "vision_key_missing" }, 500);

  const sb = admin();
  const { data, error } = await sb
    .from("submissions")
    .select("id, thumbnail_paths, screen_attempts")
    .eq("status", "screening")
    .lt("screen_attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) return json({ error: error.message }, 500);

  const rows = (data ?? []) as Row[];
  let passed = 0;
  let blocked = 0;
  const failures: Record<string, string> = {};

  for (const row of rows) {
    // Deneme sayısı ÖNCE artıyor: Vision'da takılan bir görüntü sırayı sonsuza kadar
    // tutmasın. Üç denemeden sonra cron testi açıyor ve `screened_at` boş kalıyor.
    await sb
      .from("submissions")
      .update({ screen_attempts: row.screen_attempts + 1 })
      .eq("id", row.id);

    try {
      const images: Uint8Array[] = [];
      for (const path of row.thumbnail_paths) {
        const file = await sb.storage.from("media").download(path);
        if (file.error) throw new Error(file.error.message);
        images.push(new Uint8Array(await file.data.arrayBuffer()));
      }
      if (images.length === 0) {
        await sb.rpc("screening_passed", { p_submission_id: row.id });
        passed += 1;
        continue;
      }

      const results = await safeSearch(visionKey, images);
      const reason = results.map((r) => verdict(r.safeSearchAnnotation)).find(Boolean) ?? null;

      if (reason) {
        await sb.rpc("screening_failed", { p_submission_id: row.id, p_reason: reason });
        blocked += 1;
      } else {
        await sb.rpc("screening_passed", { p_submission_id: row.id });
        passed += 1;
      }
    } catch (e) {
      // Hata testi ENGELLEMEZ: tarayıcının arızası, yükleyen kişinin suçu değil. Satır
      // sırada kalır, üç denemeden sonra cron açar.
      failures[row.id] = String(e);
    }
  }

  return json({ checked: rows.length, passed, blocked, failures });
});
