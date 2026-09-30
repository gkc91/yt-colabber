/** Site-wide constants for the landing pages (E1). */

export const SITE_URL = (import.meta.env.PUBLIC_SITE_URL ?? 'https://clickabletest.com').replace(
  /\/+$/,
  '',
);

/** Support and privacy contact; forwarded by Cloudflare Email Routing. */
export const CONTACT_EMAIL = 'support@clickabletest.com';

/**
 * Ölçüm (0049). Bu anahtar GİZLİ DEĞİL: PostHog'un proje anahtarı tasarımı gereği
 * istemciye gömülür ve uygulamanın paketinde de aynısı duruyor. Ortam değişkeni yerine
 * burada durmasının sebebi, gizlilik değil UNUTULMAZLIK: Cloudflare'de tanımlanmayı
 * bekleyen bir değişken, tanımlanana kadar ölçümü SESSİZCE kapalı tutuyordu.
 *
 * Bölge EU olarak DOĞRULANDI (girişsiz): `eu.i.posthog.com/array/<key>/config` tam
 * yapılandırma döndürüyor, `us.i.posthog.com` aynı anahtara 404 veriyor. Gizlilik
 * politikasındaki "AB" ifadesi de bununla tutarlı.
 */
export const POSTHOG_KEY = 'phc_xpGfSBmGcceDC2aA5xwEs7ZAxD3AYj8L2zciKoRnWHXG';
export const POSTHOG_HOST = 'https://eu.i.posthog.com';

/**
 * Ölçümün açık olduğu tek yer: gerçek alan adı. Yerel geliştirme ve Cloudflare'in
 * `*.pages.dev` önizleme adresleri veriye karışmasın — yoksa her dağıtım önizlemesi
 * "ziyaret" sayılır ve huni kendi gürültümüzle dolar.
 */
export const ANALYTICS_HOSTNAME = 'clickabletest.com';

export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

/** Web sürümü (E2): mağaza sürümü yokken insanlar tarayıcıdan deneyebilsin. */
export const WEB_APP_URL = 'https://app.clickabletest.com';

/** Store links are filled in with E3; until then the buttons say "coming soon". */
export const STORE: { ios: string | null; android: string | null } = {
  ios: null,
  android: null,
};

/**
 * The niches of `supabase/migrations/0001_init.sql`, minus `other`:
 * a page has to answer one search intent, and "other" is not one.
 */
export const NICHES = [
  { slug: 'animation', en: 'Animation', tr: 'Animasyon' },
  { slug: 'gaming', en: 'Gaming', tr: 'Oyun' },
  { slug: 'education', en: 'Education & Explainers', tr: 'Eğitim ve Anlatım' },
  { slug: 'tech', en: 'Tech & Software', tr: 'Teknoloji ve Yazılım' },
  { slug: 'finance', en: 'Finance', tr: 'Finans' },
  { slug: 'fitness', en: 'Fitness & Health', tr: 'Fitness ve Sağlık' },
  { slug: 'vlog', en: 'Vlog & Lifestyle', tr: 'Vlog ve Yaşam' },
  { slug: 'food', en: 'Food & Cooking', tr: 'Yemek' },
  { slug: 'music', en: 'Music', tr: 'Müzik' },
  { slug: 'diy', en: 'DIY & Crafts', tr: 'Kendin Yap' },
  { slug: 'science', en: 'Science', tr: 'Bilim' },
  { slug: 'comedy', en: 'Comedy & Entertainment', tr: 'Komedi ve Eğlence' },
  { slug: 'travel', en: 'Travel', tr: 'Seyahat' },
  { slug: 'kids', en: 'Kids & Family', tr: 'Çocuk ve Aile' },
] as const;

export type Niche = (typeof NICHES)[number];

export const nicheName = (niche: Niche, locale: Locale): string => niche[locale];

/** `/thumbnail-test` in English, `/tr/thumbnail-test` in Turkish. */
export function localePath(path: string, locale: Locale): string {
  const clean = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`;
  if (locale === 'en') return clean;
  return clean === '/' ? '/tr' : `/tr${clean}`;
}

export const canonical = (path: string, locale: Locale): string =>
  `${SITE_URL}${localePath(path, locale)}`;

/** Every page of the site, in one list: the sitemap and the checks read it. */
export const ROUTES: string[] = [
  '/',
  '/thumbnail-test',
  '/hook-test',
  '/privacy',
  '/terms',
  '/delete-account',
  ...NICHES.map((niche) => `/for/${niche.slug}`),
];
