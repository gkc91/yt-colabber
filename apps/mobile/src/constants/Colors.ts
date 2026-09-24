// Ekranların kullandığı renk adları; değerler tasarım tokenlarından gelir (DESIGN.md §3).
// Not: şablonun varsayılan mavisi burada kaldırıldı ve geri gelmeyecek.
import { palette } from '@/design/tokens';

const map = (scheme: 'light' | 'dark') => {
  const c = palette[scheme];
  return {
    text: c.ink,
    background: c.paper,
    surface: c.surface,
    tint: c.accent,
    onTint: c.onAccent,
    border: c.line,
    muted: c.muted,
    // Hata da aynı kırmızıdır: ekranda ikinci bir kırmızı olmaz.
    danger: c.accent,
    positive: c.positive,
    tabIconDefault: c.muted,
    tabIconSelected: c.accent,
  };
};

export default {
  light: map('light'),
  dark: map('dark'),
};
