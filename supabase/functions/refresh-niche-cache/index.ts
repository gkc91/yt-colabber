// YouTube Data API v3 (public, API key) ile niş başına decoy thumbnail toplar. Günlük cron.
import { admin, json } from "../_shared/supabase.ts";

const KEY = Deno.env.get("YOUTUBE_API_KEY")!;
const MIN_VIEWS = 1_000, MAX_VIEWS = 500_000, PER_NICHE = 200;

async function search(q: string): Promise<string[]> {
  const u = new URL("https://www.googleapis.com/youtube/v3/search");
  u.search = new URLSearchParams({ part: "snippet", type: "video", maxResults: "50", q, videoDuration: "medium", order: "date", key: KEY }).toString();
  const j = await (await fetch(u)).json();
  return (j.items ?? []).map((i: any) => i.id.videoId);
}
async function stats(ids: string[]) {
  const u = new URL("https://www.googleapis.com/youtube/v3/videos");
  u.search = new URLSearchParams({ part: "snippet,statistics", id: ids.join(","), key: KEY }).toString();
  const j = await (await fetch(u)).json();
  return (j.items ?? []).map((v: any) => ({
    video_id: v.id, title: v.snippet.title, channel_title: v.snippet.channelTitle,
    thumbnail_url: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url,
    view_count: Number(v.statistics?.viewCount ?? 0),
  })).filter((v: any) => v.thumbnail_url && v.view_count >= MIN_VIEWS && v.view_count <= MAX_VIEWS);
}

Deno.serve(async () => {
  const sb = admin();
  const { data: niches } = await sb.from("niches").select("id, queries").eq("is_active", true);
  const report: Record<number, number> = {};
  for (const n of niches ?? []) {
    let ids: string[] = [];
    for (const q of (n.queries ?? []) as string[]) ids.push(...await search(q));
    ids = [...new Set(ids)];
    const rows: any[] = [];
    for (let i = 0; i < ids.length; i += 50) rows.push(...await stats(ids.slice(i, i + 50)));
    const upsert = rows.slice(0, PER_NICHE).map((r) => ({ ...r, niche_id: n.id, fetched_at: new Date().toISOString() }));
    if (upsert.length) await sb.from("niche_thumbnail_cache").upsert(upsert, { onConflict: "niche_id,video_id" });
    const { data: all } = await sb.from("niche_thumbnail_cache").select("id").eq("niche_id", n.id).order("fetched_at", { ascending: false });
    const extra = (all ?? []).slice(PER_NICHE).map((r) => r.id);
    if (extra.length) await sb.from("niche_thumbnail_cache").delete().in("id", extra);
    report[n.id] = upsert.length;
  }
  return json({ ok: true, report });
});
