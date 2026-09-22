// Görev sahibi (reviewer) veya submission sahibi için 60 dk signed URL üretir.
import { admin, userFromRequest, json } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  try {
    const user = await userFromRequest(req);
    const { task_id, submission_id } = await req.json();
    const sb = admin();
    let sub: { id: string; owner_id: string; thumbnail_paths: string[]; clip_path: string } | null = null;

    if (task_id) {
      const { data: task } = await sb.from("review_tasks").select("submission_id, reviewer_id, status, expires_at").eq("id", task_id).single();
      if (!task || task.reviewer_id !== user.id || task.status !== "assigned" || new Date(task.expires_at) < new Date())
        return json({ error: "no_access" }, 403);
      const { data } = await sb.from("submissions").select("id, owner_id, thumbnail_paths, clip_path").eq("id", task.submission_id).single();
      sub = data;
    } else if (submission_id) {
      const { data } = await sb.from("submissions").select("id, owner_id, thumbnail_paths, clip_path").eq("id", submission_id).single();
      if (!data || data.owner_id !== user.id) return json({ error: "no_access" }, 403);
      sub = data;
    }
    if (!sub) return json({ error: "not_found" }, 404);

    const paths = [...sub.thumbnail_paths, sub.clip_path];
    const { data: signed, error } = await sb.storage.from("media").createSignedUrls(paths, 3600);
    if (error) return json({ error: error.message }, 500);
    const urls = Object.fromEntries(signed.map((s) => [s.path, s.signedUrl]));
    return json({ thumbnails: sub.thumbnail_paths.map((p) => urls[p]), clip: urls[sub.clip_path] });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
