import type { Locale } from './site';

/** Chrome around the pages: nav, footer, shared calls to action. */
export const UI = {
  en: {
    brand: 'Clickable',
    tagline: 'Pre-publish feedback for small YouTube channels',
    nav: {
      thumbnail: 'Thumbnail test',
      hook: 'Hook test',
      niches: 'Your niche',
    },
    cta: {
      primary: 'Get the app',
      comingSoon: 'Coming soon',
      ios: 'App Store',
      android: 'Google Play',
      web: 'Open in your browser',
      note: 'Sign up gives you 5 credits. One review you give = one credit. Reviewing works in the browser; uploading a test needs the app.',
    },
    footer: {
      privacy: 'Privacy',
      terms: 'Terms',
      language: 'Türkçe',
      rights: 'Clickable. Not affiliated with YouTube or Google.',
    },
    skip: 'Skip to content',
  },
  tr: {
    brand: 'Clickable',
    tagline: 'Küçük YouTube kanalları için yayın öncesi geri bildirim',
    nav: {
      thumbnail: 'Thumbnail testi',
      hook: 'Hook testi',
      niches: 'Nişin',
    },
    cta: {
      primary: 'Uygulamayı indir',
      comingSoon: 'Yakında',
      ios: 'App Store',
      android: 'Google Play',
      web: 'Tarayıcıda aç',
      note: 'Kayıtta 5 kredi. Verdiğin her değerlendirme = 1 kredi. Değerlendirme tarayıcıda çalışır; test açmak için uygulama gerekir.',
    },
    footer: {
      privacy: 'Gizlilik',
      terms: 'Şartlar',
      language: 'English',
      rights: 'Clickable. YouTube veya Google ile bağlantılı değildir.',
    },
    skip: 'İçeriğe geç',
  },
} satisfies Record<Locale, unknown>;

export const ui = (locale: Locale) => UI[locale];
