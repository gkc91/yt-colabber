// Tasarım tokenları (DESIGN.md). Ekranlar ham değer yazmaz, buradan alır.
//
// Fikir: "sana gerçeği söyleyen bir rapor" — kâğıt zemin, keskin metin, kahraman sayılar,
// yalnızca gerektiğinde beliren tek bir kırmızı. Palet landing ile aynı (clickabletest.com).

export const palette = {
  light: {
    paper: '#FAF9F7',
    surface: '#FFFFFF',
    ink: '#16161A',
    muted: '#6B6862',
    line: '#E6E2DC',
    accent: '#D92D20',
    onAccent: '#FFFFFF',
    positive: '#1F7A4C',
  },
  dark: {
    paper: '#0F1115',
    surface: '#171A20',
    ink: '#F2F4F7',
    muted: '#A3ABB8',
    line: '#262B33',
    accent: '#FF5A4D',
    onAccent: '#14161A',
    positive: '#4ADE80',
  },
} as const;

export type Scheme = keyof typeof palette;
export type ColorName = keyof (typeof palette)['light'];

/** Boşluk ölçeği. Ara değer yok — ritim buradan geliyor (DESIGN.md §5). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  card: 12,
  button: 10,
  pill: 999,
} as const;

/** Tip ölçeği (DESIGN.md §4). `display` büyük sayılar için. */
export const type = {
  display: { size: 40, lineHeight: 44, weight: '700' as const, tracking: -0.8 },
  title: { size: 28, lineHeight: 32, weight: '700' as const, tracking: -0.6 },
  heading: { size: 20, lineHeight: 26, weight: '700' as const, tracking: -0.3 },
  body: { size: 17, lineHeight: 24, weight: '400' as const, tracking: 0 },
  small: { size: 15, lineHeight: 21, weight: '400' as const, tracking: 0 },
  meta: { size: 13, lineHeight: 18, weight: '500' as const, tracking: 0.2 },
} as const;

export type TypeName = keyof typeof type;

/** Başlıklar ve sayılar Archivo; gövde sistem fontu (hızlı açılış, her yerde okunur). */
export const fonts = {
  display: 'Archivo_700Bold',
  heading: 'Archivo_600SemiBold',
} as const;

/** Ekran çerçevesi: uzun satır okunmaz, geniş ekranda içerik yayılmaz. */
export const layout = {
  maxWidth: 640,
  gutter: 20,
  minTouch: 44,
} as const;
