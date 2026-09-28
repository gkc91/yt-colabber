import { createClient } from "npm:@supabase/supabase-js@2";

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

// İstekteki JWT ile çalışan client: RLS ve auth.uid() çağıran kullanıcı için geçerlidir.
export const userClient = (req: Request) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

// İstek yapan kullanıcıyı JWT'den çöz (client'tan gelen çağrılar için)
export const userFromRequest = async (req: Request) => {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Response("unauthorized", { status: 401 });
  return data.user;
};

/**
 * CORS. Tarayıcıdan çağrılan her fonksiyon bunu taşımak ZORUNDA (2026-09-25 canlı bulgu):
 * yerelde Kong başlıkları kendisi eklediği için eksiklik görünmüyor, barındırılan ortamda
 * ön kontrol (OPTIONS) 405 alıyor ve tarayıcı isteği hiç göndermiyor.
 *
 * `*` bilerek: yetki Authorization başlığındaki JWT'de, çerezde değil. Başka bir site
 * kullanıcının token'ını ele geçiremediği için köken kısıtlaması burada güvenlik katmıyor,
 * yalnızca yeni bir alan adı eklendiğinde sessizce bozulacak bir ayar yaratırdı.
 */
export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-max-age": "86400",
};

/** Ön kontrol isteğiyse cevabı döner; değilse null (çağıran devam eder). */
export const preflight = (req: Request) =>
  req.method === "OPTIONS" ? new Response(null, { status: 204, headers: CORS_HEADERS }) : null;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });

/**
 * Bu çağrı veritabanının kendisinden mi geliyor.
 *
 * Neden ayrı bir sır (2026-09-28): bu fonksiyonları `pg_net` ile Postgres çağırıyor ve
 * `net.http_request_queue` giden isteğin başlıklarını `headers jsonb` sütununda saklıyor.
 * Oraya service_role anahtarını koyarsak, o satırı bir gün okuyabilen herkes veritabanının
 * tamamını ele geçirir — RLS'i atlar, kredi defterine yazar.
 *
 * Bugün o satır erişilebilir değil: Supabase `net` şemasını Data API'den açmıyor ve
 * `anon`/`authenticated` NOLOGIN rolleri, doğrudan bağlanamıyorlar. Yani bu bir açık
 * kapatma değil, patlama yarıçapını küçültme: yarın o satır bir şekilde görünür olursa
 * sızan şey "tarayıcıyı tetikleyebilirim" olsun, "veritabanı benim" değil.
 *
 * GEÇİŞ: NET_SHARED_SECRET tanımlıysa o kabul edilir; tanımlı değilse eski service_role
 * karşılaştırmasına düşer. Böylece fonksiyonlar ve migration birbirini beklemeden,
 * herhangi bir sırayla yayınlanabiliyor. Sır her yere yerleştikten sonra bu yedek kalkar.
 */
export const INTERNAL_HEADER = "x-internal-secret";

export function isInternalCall(req: Request): boolean {
  const shared = Deno.env.get("NET_SHARED_SECRET");
  if (shared && req.headers.get(INTERNAL_HEADER) === shared) return true;

  // Geçiş yedeği: 0037 yayınlanana kadar eski yol da kabul. Sır her yere yerleştikten
  // ve dört cron işinin 200 döndüğü görüldükten sonra bu iki satır silinir.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return Boolean(serviceKey) && req.headers.get("Authorization") === `Bearer ${serviceKey}`;
}