// Pro: değerlendirmeleri 5 maddeye indirir (Claude Haiku 4.5). D3.
//
// Bizim Anthropic anahtarımızla çalışır, yani her çağrı bizim paramız. Korumalar sunucuda:
// `claim_ai_summary` Pro'yu, testin sahipliğini, en az 8 değerlendirmeyi ve 30 günlük
// kullanım sınırını kontrol eder; hak talebi ÖNCE yazılır, üretim başarısız olursa geri alınır.
//
// Fail-closed: anahtar yoksa model hiç çağrılmaz ve `submissions.ai_summary` kirletilmez.
// (Eski hâli anahtar yokken isteği yine gönderiyor, dönen hata metnini özet diye kaydediyordu;
// alan dolduğu için de bir daha üretilemiyordu.)
import { admin, userFromRequest, json, preflight } from "../_shared/supabase.ts";

const MODEL = "claude-haiku-4-5";
/** Yerel testte sahte bir uca yönlendirilir (notify'daki EXPO_PUSH_URL ile aynı yöntem). */
const ANTHROPIC_URL = Deno.env.get("ANTHROPIC_BASE_URL") ?? "https://api.anthropic.com";
const MAX_TOKENS = 700;
/** Sonuç JSON'u ne kadar büyük olursa olsun istem sınırlı kalsın (maliyet öngörülebilir olsun). */
const MAX_RESULTS_CHARS = 12_000;

/** Talep reddi → HTTP durumu. Hepsi kullanıcıya gösterilebilir sebeplerdir. */
const CLAIM_STATUS: Record<string, number> = {
  no_access: 403,
  pro_required: 402,
  not_enough_reviews: 409,
  monthly_limit: 429,
  in_progress: 409,
};

function buildPrompt(titles: unknown, results: unknown): string {
  return [
    "You are a YouTube growth coach. Below are structured pre-publish test results for a",
    "small channel's video: which thumbnail people picked in a simulated feed, what they",
    "thought the title promised, where they stopped watching in the first 60 seconds, the",
    "reason tags they chose, and their comments.",
    "",
    "Write exactly 5 bullet points: what works, what to change, concrete and blunt. Ground",
    "every point in the numbers below — never invent detail you cannot see, and say how many",
    "reviewers a claim rests on. You have not watched the video; you only have this data.",
    "Then one final line starting with 'Highest-impact change:' naming the single change worth",
    "making first.",
    "",
    `Title options: ${JSON.stringify(titles)}`,
    "Results JSON:",
    JSON.stringify(results).slice(0, MAX_RESULTS_CHARS),
  ].join("\n");
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ai_summary_unavailable" }, 503);

    const user = await userFromRequest(req);
    const body = await req.json().catch(() => null);
    const submissionId = body?.submission_id;
    if (typeof submissionId !== "string") return json({ error: "bad_request" }, 400);

    const sb = admin();

    // Önbellek: test başına tek özet.
    const { data: sub, error: subError } = await sb
      .from("submissions")
      .select("owner_id, title_options, ai_summary")
      .eq("id", submissionId)
      .maybeSingle();
    if (subError) return json({ error: subError.message }, 500);
    if (!sub || sub.owner_id !== user.id) return json({ error: "no_access" }, 403);
    if (sub.ai_summary) return json({ summary: sub.ai_summary, cached: true });

    // Hak talebi: Pro + sahiplik + yeterli veri + 30 günlük sınır, hepsi tek yerde.
    const { data: claim, error: claimError } = await sb.rpc("claim_ai_summary", {
      p_profile: user.id,
      p_submission: submissionId,
    });
    if (claimError) return json({ error: claimError.message }, 500);
    if (claim !== "ok") return json({ error: claim }, CLAIM_STATUS[claim as string] ?? 400);

    try {
      const { data: results, error: resultsError } = await sb.rpc("submission_results", {
        p_id: submissionId,
        p_uid: user.id,
      });
      if (resultsError) throw new Error(resultsError.message);

      const response = await fetch(`${ANTHROPIC_URL}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: [{ role: "user", content: buildPrompt(sub.title_options, results) }],
        }),
      });

      if (!response.ok) throw new Error(`anthropic_${response.status}`);
      const payload = await response.json();
      const text = (payload.content ?? [])
        .map((block: { text?: string }) => block.text ?? "")
        .join("\n")
        .trim();
      if (!text) throw new Error("empty_summary");

      const { error: writeError } = await sb
        .from("submissions")
        .update({ ai_summary: text })
        .eq("id", submissionId);
      if (writeError) throw new Error(writeError.message);

      return json({ summary: text, cached: false });
    } catch (failure) {
      // Bizim hatamız kullanıcının hakkından düşmesin.
      await sb.rpc("release_ai_summary_claim", { p_submission: submissionId });
      return json({ error: "summary_failed", detail: String(failure) }, 502);
    }
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
