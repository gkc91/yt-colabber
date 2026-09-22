// Pro: değerlendirmeleri 5 maddeye indirir (Claude Haiku).
import { admin, userFromRequest, json } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  try {
    const user = await userFromRequest(req);
    const { submission_id } = await req.json();
    const sb = admin();
    const { data: pro } = await sb.rpc("is_pro", { p: user.id });
    if (!pro) return json({ error: "pro_required" }, 402);
    const { data: sub } = await sb.from("submissions").select("owner_id, title_options, ai_summary").eq("id", submission_id).single();
    if (!sub || sub.owner_id !== user.id) return json({ error: "no_access" }, 403);
    if (sub.ai_summary) return json({ summary: sub.ai_summary });

    const { data: results } = await sb.rpc("submission_results", { p_id: submission_id, p_uid: user.id });
    const prompt = `You are a YouTube growth coach. Below are structured pre-publish test results for a small channel's video (thumbnail picks in a simulated feed, what viewers thought the video promised, where they stopped watching in the first 60s, and comments). Write exactly 5 bullet points: what works, what to change, concrete and blunt. Then one line: the single highest-impact change.\n\nTitle options: ${JSON.stringify(sub.title_options)}\nResults JSON:\n${JSON.stringify(results).slice(0, 12000)}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    const text = (j.content ?? []).map((c: any) => c.text ?? "").join("\n");
    await sb.from("submissions").update({ ai_summary: text }).eq("id", submission_id);
    return json({ summary: text });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
