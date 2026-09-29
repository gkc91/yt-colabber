// Kullanıcının gerçek hak durumunu RevenueCat'ten çeker ve yazar (0043).
//
// NEDEN VAR. Webhook tek yönlü ve kalıcı olarak kaybolabilir. Kaybolursa kullanıcı ödemiş
// olmasına rağmen Pro açılmaz ve 40 kredisi yazılmaz; ya da `expiration_at_ms` taşımayan
// bir olay `expires_at = null` bırakır ve Pro bir daha kapanmaz. Bu fonksiyon o yolun
// telafisi: uygulama her açıldığında ve "satın almaları geri yükle"ye basıldığında
// çağrılıyor, ve duruma RevenueCat'in kendi cevabı karar veriyor.
//
// YETKİ NEREDE. İstemci yalnızca "beni senkronize et" diyebilir. Kimliği JWT'den çözülüyor
// ve YALNIZCA kendi profili için çalışıyor — gövdeden profil kimliği kabul edilmiyor, yoksa
// bir kullanıcı başkasının hakkını değiştirebilirdi. Durumu RevenueCat'e SUNUCU soruyor;
// telefonun "ben Pro'yum" demesinin hiçbir hükmü yok (CLAUDE.md: doğrulama sunucuda).
//
// TÜKETİLEBİLİR KREDİLER NEDEN BURADAN VERİLMİYOR (bilinçli eksiklik):
// Webhook satın almayı `event.id` (olay kimliği) ile tekilleştiriyor, RevenueCat'in API'si
// ise işlemleri `id` (işlem kimliği) ile döndürüyor. İkisinin aynı satın alma için aynı
// değeri taşıdığına inanıyorum ama GERÇEK BİR SATIN ALMAYLA DOĞRULAMADIM. Yanılıyorsam
// buradan kredi basmak aynı satın almayı iki kez kredilendirir — yani bedava kredi dağıtır.
// Bu yüzden şimdilik yalnızca SAYILIYOR ve yanıtta `creditsUnseen` olarak bildiriliyor.
// İlk gerçek satın almada `purchases.rc_transaction_id` ile RevenueCat'in işlem kimliği
// karşılaştırılacak; tuttuğu görülürse bu sayım otomatik hibeye çevrilebilir.
import { admin, json, preflight, userFromRequest } from "../_shared/supabase.ts";
import { nonSubscriptionsFrom, proStateFrom } from "../_shared/rcSubscriber.ts";

const RC_API = Deno.env.get("RC_API_BASE") ?? "https://api.revenuecat.com";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return new Response("method", { status: 405 });

  // Sır yoksa fonksiyon hiçbir şey yapmaz. Sessizce "Pro değil" dönmek, ödeyen kullanıcının
  // hakkını sırrın unutulması yüzünden elinden alırdı; hata görünür olmalı.
  const apiKey = Deno.env.get("RC_SECRET_API_KEY");
  if (!apiKey) return json({ error: "rc_api_key_missing" }, 500);

  let user;
  try {
    user = await userFromRequest(req);
  } catch (response) {
    return response instanceof Response ? response : json({ error: "unauthorized" }, 401);
  }

  const res = await fetch(`${RC_API}/v1/subscribers/${encodeURIComponent(user.id)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });

  // 404 = RevenueCat bu kullanıcıyı hiç görmemiş (hiç satın alma yapmamış). Bu bir hata
  // değil, geçerli bir cevap: hak yok.
  if (res.status === 404) {
    return json({ ok: true, pro: false, known: false, creditsUnseen: 0 });
  }
  if (!res.ok) {
    // 5xx dönüyoruz ki istemci "senkron oldu" sanmasın ve tekrar denesin.
    return json({ error: "revenuecat_unavailable", status: res.status }, 502);
  }

  const payload = await res.json();
  const pro = proStateFrom(payload);

  const client = admin();
  const { data: synced, error } = await client.rpc("sync_pro_state", {
    p_profile: user.id,
    p_active: pro.active,
    p_expires: pro.expiresAt,
  });
  if (error) return json({ error: error.message }, 500);

  // Görünürlük için: RevenueCat'in bildiği ama bizde karşılığı olmayan tek seferlik
  // satın almalar. Hibe YOK (yukarıdaki nota bakın) — ama sayı sıfırdan büyükse bir yerde
  // kredi kaybolmuş demektir ve bunu bilmek istiyoruz.
  const transactions = nonSubscriptionsFrom(payload);
  let creditsUnseen = 0;
  if (transactions.length > 0) {
    const { data: seen } = await client
      .from("purchases")
      .select("rc_transaction_id")
      .eq("profile_id", user.id)
      .in("rc_transaction_id", transactions.map((t) => t.transactionId));
    const known = new Set((seen ?? []).map((row) => row.rc_transaction_id));
    creditsUnseen = transactions.filter((t) => !known.has(t.transactionId)).length;
  }

  return json({ ok: true, pro: pro.active, known: true, synced, creditsUnseen });
});
