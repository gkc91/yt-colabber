// Ölçüm (E4). PostHog'un capture uç noktasına yalnızca ADINI KOYDUĞUMUZ olayları gönderir.
//
// Neden SDK değil: PostHog'un React Native SDK'sı dokunma yakalama ve oturum kaydı getiriyor.
// Bu üründe ekranda başkasının YAYINLANMAMIŞ videosu oynuyor — onu kaydeden bir araç
// koyamayız (PRODUCT §7, gizlilik politikası). Bize gereken sekiz olay; gerisi risk.
// Ayrıca tek bir uygulama hem web'de hem cihazda aynı şekilde çalışıyor.
//
// Anahtar yoksa hiçbir şey gönderilmez (fail-closed) ve hiçbir çağrı hata fırlatmaz:
// ölçüm, ürünün çalışmasını asla engellememeli.

/** Huni (GROWTH §7): kayıt → onboarding → değerlendirme → test açma. */
export type AnalyticsEvent =
  | 'signed_in'
  | 'onboarding_done'
  | 'task_started'
  | 'review_submitted'
  | 'review_rejected'
  | 'submission_created'
  | 'paywall_viewed'
  | 'purchase';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

/**
 * Her olaya eklenen sabit künye: olay hangi sürümden geldi.
 *
 * NEDEN: bu bilgi olmadan iki build'in verisi tek havuzda karışıyor. Yeni bir sürüm
 * çıktığında "değerlendirme sayısı düştü" sorusunun cevabı, düşüşün yeni sürümden mi
 * yoksa eski sürümde kalanlardan mı geldiğini ayırt edemeden verilemiyor. Profildeki
 * sürüm satırı (AppVersion) insana aynı soruyu cevaplıyor; bu da panele cevaplıyor.
 */
export type AnalyticsContext = Record<string, string | number | boolean | null>;

export interface AnalyticsOptions {
  key?: string;
  host?: string;
  /** Her olaya eklenen sabit alanlar (sürüm, build, platform). */
  context?: AnalyticsContext;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Hata ayıklarken görünürlük; varsayılan sessiz. */
  onError?: (error: unknown) => void;
}

export interface Analytics {
  identify(distinctId: string): void;
  reset(): void;
  capture(event: AnalyticsEvent, properties?: AnalyticsProps): void;
  readonly enabled: boolean;
}

export function buildCaptureBody(input: {
  key: string;
  event: AnalyticsEvent;
  distinctId: string;
  properties?: AnalyticsProps;
  context?: AnalyticsContext;
  timestamp: string;
}) {
  return {
    api_key: input.key,
    event: input.event,
    distinct_id: input.distinctId,
    timestamp: input.timestamp,
    // Künye önce yazılıyor ki olayın kendi alanları onu ezebilsin; sürüm alanları
    // hiçbir olayın özellik adıyla çakışmıyor, ama sıra yine de açık dursun.
    properties: { ...(input.context ?? {}), ...(input.properties ?? {}), $lib: 'clickable-app' },
  };
}

export function createAnalytics({
  key,
  context,
  host = 'https://eu.i.posthog.com',
  fetchImpl = fetch,
  now = () => new Date(),
  onError,
}: AnalyticsOptions): Analytics {
  /** Giriş yapılmamışken de olay gönderilebilsin diye cihaz başına sabit bir kimlik. */
  let distinctId = `anon-${Math.random().toString(36).slice(2, 12)}`;
  const enabled = Boolean(key);

  return {
    enabled,

    identify(id) {
      if (id) distinctId = id;
    },

    reset() {
      distinctId = `anon-${Math.random().toString(36).slice(2, 12)}`;
    },

    capture(event, properties) {
      if (!key) return;
      const body = buildCaptureBody({
        key,
        event,
        distinctId,
        properties,
        context,
        timestamp: now().toISOString(),
      });

      // Ateşle ve unut: ölçüm hiçbir akışı bekletmez, hiçbir hatayı yukarı taşımaz.
      void Promise.resolve()
        .then(() =>
          fetchImpl(`${host.replace(/\/$/, '')}/capture/`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
        )
        .catch((error) => onError?.(error));
    },
  };
}
