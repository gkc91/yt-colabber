// Niş başına decoy thumbnail toplar: YouTube Data API v3 (public, API key).
// Günlük cron çağırır (0006: trigger_refresh_niche_cache). Yerelde elle de çağrılabilir.
// YouTube'da hiçbir etkileşim üretmez — yalnızca herkese açık arama sonuçlarını okur (PRODUCT §9).
import { admin, json } from "../_shared/supabase.ts";

const KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";

const MIN_VIEWS = 1_000;
// Shorts elenir: dikey thumbnail'lar feed ızgarasında yamuk durur ve aday thumbnail'e
// benzemez. Süre filtresini aramada değil burada uyguluyoruz — arama filtresi (medium)
// aday havuzunu gereksiz daraltıyordu.
const MIN_DURATION_SECONDS = 61;
const MAX_VIEWS = 500_000;
const PER_NICHE = 200;
const QUERIES_PER_NICHE = 3;
const SEARCH_PAGE_SIZE = 50;

type Candidate = {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  view_count: number;
  duration_seconds?: number;
};

/** "PT4M13S" → 253 */
function isoDurationToSeconds(iso: string): number {
  const match = iso.match(/^P(?:([\d.]+)D)?T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?$/);
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}

class YouTubeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function youtube(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  url.search = new URLSearchParams({ ...params, key: KEY }).toString();
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) {
    // Kota dolduğunda 403 döner; cron'un bunu gürültüsüzce raporlaması gerekiyor.
    throw new YouTubeError(response.status, body?.error?.message ?? "youtube_error");
  }
  return body;
}

async function searchVideoIds(query: string): Promise<string[]> {
  const body = await youtube("search", {
    part: "snippet",
    type: "video",
    maxResults: String(SEARCH_PAGE_SIZE),
    order: "relevance",
    q: query,
  });
  return (body.items ?? [])
    .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
    .filter((id: string | undefined): id is string => !!id);
}

async function fetchStats(ids: string[]): Promise<Candidate[]> {
  const body = await youtube("videos", {
    part: "snippet,statistics,contentDetails",
    id: ids.join(","),
  });
  return (body.items ?? [])
    .map((video: Record<string, any>) => ({
      video_id: video.id as string,
      title: video.snippet?.title as string,
      channel_title: video.snippet?.channelTitle as string,
      thumbnail_url: (video.snippet?.thumbnails?.high ?? video.snippet?.thumbnails?.medium)?.url as string,
      view_count: Number(video.statistics?.viewCount ?? 0),
      duration_seconds: isoDurationToSeconds(video.contentDetails?.duration ?? ""),
    }))
    .filter(
      (candidate: Candidate) =>
        candidate.thumbnail_url &&
        candidate.title &&
        candidate.view_count >= MIN_VIEWS &&
        candidate.view_count <= MAX_VIEWS &&
        candidate.duration_seconds >= MIN_DURATION_SECONDS,
    )
    .map(({ duration_seconds: _duration, ...row }: Candidate) => row);
}

Deno.serve(async (req) => {
  if (!KEY) return json({ error: "missing_youtube_api_key" }, 500);

  // Tek niş yenilemek için: {"niche":"animation"}. Arama başına 100 kota birimi gider,
  // tam tur 4.500 birim; günlük hak 10.000. Elle denerken tek nişle çalış.
  const { niche: onlyNiche = null } = await req.json().catch(() => ({}));

  const sb = admin();
  let query = sb.from("niches").select("id, slug, queries").eq("is_active", true);
  if (onlyNiche) query = query.eq("slug", onlyNiche);
  const { data: niches, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const report: Record<string, number> = {};
  const failures: Record<string, string> = {};

  for (const niche of niches ?? []) {
    const queries = (niche.queries ?? []).slice(0, QUERIES_PER_NICHE);
    if (queries.length === 0) continue;

    try {
      const ids = new Set<string>();
      for (const query of queries) {
        for (const id of await searchVideoIds(query)) ids.add(id);
      }

      const candidates: Candidate[] = [];
      const idList = [...ids];
      for (let i = 0; i < idList.length; i += 50) {
        candidates.push(...(await fetchStats(idList.slice(i, i + 50))));
      }
      if (candidates.length === 0) {
        report[niche.slug] = 0;
        continue;
      }

      const rows = candidates.slice(0, PER_NICHE).map((candidate) => ({
        ...candidate,
        niche_id: niche.id,
        fetched_at: new Date().toISOString(),
      }));
      const { error: upsertError } = await sb
        .from("niche_thumbnail_cache")
        .upsert(rows, { onConflict: "niche_id,video_id" });
      if (upsertError) throw new Error(upsertError.message);

      // Niş başına en yeni PER_NICHE satır kalsın.
      const { data: all } = await sb
        .from("niche_thumbnail_cache")
        .select("id")
        .eq("niche_id", niche.id)
        .order("fetched_at", { ascending: false });
      const extra = (all ?? []).slice(PER_NICHE).map((row) => row.id);
      if (extra.length > 0) await sb.from("niche_thumbnail_cache").delete().in("id", extra);

      report[niche.slug] = rows.length;
    } catch (e) {
      failures[niche.slug] = e instanceof Error ? e.message : String(e);
      // Kota bittiyse kalan nişleri denemenin anlamı yok.
      if (e instanceof YouTubeError && e.status === 403) break;
    }
  }

  const ok = Object.keys(failures).length === 0;
  return json({ ok, refreshed: report, failures }, ok ? 200 : 207);
});
