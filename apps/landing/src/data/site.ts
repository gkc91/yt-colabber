/** Site-wide constants for the landing pages (E1). */

export const SITE_URL = (import.meta.env.PUBLIC_SITE_URL ?? 'https://clickabletest.com').replace(
  /\/+$/,
  '',
);

/** Support and privacy contact; forwarded by Cloudflare Email Routing. */
export const CONTACT_EMAIL = 'support@clickabletest.com';

export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

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
  ...NICHES.map((niche) => `/for/${niche.slug}`),
];
