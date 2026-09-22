// Expo push. Girdi: { profile_ids: string[], title, body, data? }. Yalnızca service role çağırır (cron / DB webhook).
import { admin, json } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) return new Response("forbidden", { status: 403 });
  const { profile_ids, title, body, data } = await req.json();
  const { data: profs } = await admin().from("profiles").select("expo_push_token").in("id", profile_ids).not("expo_push_token", "is", null);
  const messages = (profs ?? []).map((p) => ({ to: p.expo_push_token, title, body, data, sound: "default" }));
  if (!messages.length) return json({ sent: 0 });
  const r = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(messages) });
  return json({ sent: messages.length, status: r.status });
});
