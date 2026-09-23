// Bildirim kuyruğunu boşaltır: notifications tablosundaki gönderilmemiş satırları alır,
// Expo Push API'ye yollar ve sonucu satıra yazar. Cron her 5 dakikada çağırır (0011).
// Gönderim hatası veri kaybettirmez: satır kuyrukta kalır, attempts artar.
import { admin, json } from "../_shared/supabase.ts";

const EXPO_PUSH_URL = Deno.env.get("EXPO_PUSH_URL") ?? "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // Expo tek istekte 100 mesaj kabul eder
const MAX_ATTEMPTS = 5;

type Row = {
  id: string;
  profile_id: string;
  kind: "reviews_arriving" | "test_completed" | "tasks_waiting";
  payload: Record<string, unknown>;
  attempts: number;
  profiles: { expo_push_token: string | null } | null;
};

const TEXTS: Record<Row["kind"], { title: string; body: string }> = {
  reviews_arriving: {
    title: "Your reviews are arriving",
    body: "Three people have reviewed your test. Open it to see what they clicked.",
  },
  test_completed: {
    title: "Your test is done",
    body: "All reviews are in. Unused credits are back in your balance.",
  },
  tasks_waiting: {
    title: "Tests are waiting in your niche",
    body: "A few creators need reviews. Each one earns you a credit.",
  },
};

function message(row: Row, token: string) {
  const text = TEXTS[row.kind];
  return {
    to: token,
    title: text.title,
    body: text.body,
    sound: "default",
    data: { kind: row.kind, ...row.payload },
  };
}

Deno.serve(async () => {
  const sb = admin();

  const { data, error } = await sb
    .from("notifications")
    .select("id, profile_id, kind, payload, attempts, profiles(expo_push_token)")
    .is("sent_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) return json({ error: error.message }, 500);

  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return json({ sent: 0, skipped: 0, failed: 0 });

  // Token'ı olmayan kullanıcıya gönderilemez; satırı kapatırız, kuyrukta birikmesin.
  const withoutToken = rows.filter((row) => !row.profiles?.expo_push_token);
  if (withoutToken.length > 0) {
    await sb
      .from("notifications")
      .update({ sent_at: new Date().toISOString(), error: "no_push_token" })
      .in("id", withoutToken.map((row) => row.id));
  }

  const sendable = rows.filter((row) => row.profiles?.expo_push_token);
  if (sendable.length === 0) return json({ sent: 0, skipped: withoutToken.length, failed: 0 });

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(sendable.map((row) => message(row, row.profiles!.expo_push_token!))),
  });

  if (!response.ok) {
    // Expo tarafı bozuksa satırları bırakırız; sadece deneme sayısını artır.
    for (const row of sendable) {
      await sb
        .from("notifications")
        .update({ attempts: row.attempts + 1, error: `http_${response.status}` })
        .eq("id", row.id);
    }
    return json({ error: "expo_unavailable", status: response.status }, 502);
  }

  const body = await response.json();
  const tickets: { status: string; message?: string; details?: { error?: string } }[] =
    body?.data ?? [];

  let sent = 0;
  let failed = 0;
  for (const [index, row] of sendable.entries()) {
    const ticket = tickets[index];
    if (ticket?.status === "ok") {
      sent += 1;
      await sb
        .from("notifications")
        .update({ sent_at: new Date().toISOString(), attempts: row.attempts + 1, error: null })
        .eq("id", row.id);
      continue;
    }

    failed += 1;
    const reason = ticket?.details?.error ?? ticket?.message ?? "unknown";
    // Cihaz kaydı silinmişse token'ı temizle: aksi halde her turda aynı hata tekrarlanır.
    if (reason === "DeviceNotRegistered") {
      await sb.from("profiles").update({ expo_push_token: null }).eq("id", row.profile_id);
      await sb
        .from("notifications")
        .update({ sent_at: new Date().toISOString(), attempts: row.attempts + 1, error: reason })
        .eq("id", row.id);
    } else {
      await sb
        .from("notifications")
        .update({ attempts: row.attempts + 1, error: reason })
        .eq("id", row.id);
    }
  }

  return json({ sent, skipped: withoutToken.length, failed });
});
