// React Navigation'ın kendi teması da paletimizi kullansın: başlık çubuğu ve sekme
// çubuğu şablon varsayılanlarıyla kalırsa ekranın geri kalanı ne yaparsa yapsın
// uygulama "şablondan çıkmış" görünür (DESIGN.md §6).
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import { fonts, palette } from './tokens';

const build = (base: Theme, scheme: 'light' | 'dark'): Theme => {
  const c = palette[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.paper,
      card: c.paper,
      text: c.ink,
      border: c.line,
      notification: c.accent,
    },
    fonts: {
      ...base.fonts,
      bold: { ...base.fonts.bold, fontFamily: fonts.display },
    },
  };
};

export const navigationTheme = {
  light: build(DefaultTheme, 'light'),
  dark: build(DarkTheme, 'dark'),
};

/** Başlık çubuğu yazısı da Archivo olsun. */
export const headerTitleStyle = { fontFamily: fonts.heading, fontSize: 17 } as const;
