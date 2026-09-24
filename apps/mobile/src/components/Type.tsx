// Tipografi bileşenleri (DESIGN.md §4). Ekranlar punto/ağırlık yazmaz, bunları kullanır.
//
// Başlıklar ve sayılar Archivo, gövde sistem fontu. `Stat` rapor hissinin taşıyıcısı:
// sayı başlıktan büyüktür, etiketi küçük ve sessizdir.
import { StyleSheet, Text as RNText, View, type TextProps, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, space, type } from '@/design/tokens';

type Tone = 'ink' | 'muted' | 'accent' | 'positive' | 'onTint';

interface Props extends TextProps {
  tone?: Tone;
}

const toneColor = (tone: Tone, colors: (typeof Colors)['light']) =>
  ({
    ink: colors.text,
    muted: colors.muted,
    accent: colors.tint,
    positive: colors.positive,
    onTint: colors.onTint,
  })[tone];

function make(name: keyof typeof type, fontFamily?: string, defaultTone: Tone = 'ink') {
  const scale = type[name];
  return function Typed({ tone = defaultTone, style, ...rest }: Props) {
    const colors = Colors[useColorScheme()];
    return (
      <RNText
        {...rest}
        style={[
          {
            fontSize: scale.size,
            lineHeight: scale.lineHeight,
            fontWeight: fontFamily ? undefined : scale.weight,
            fontFamily,
            letterSpacing: scale.tracking,
            color: toneColor(tone, colors),
          },
          style,
        ]}
      />
    );
  };
}

export const Display = make('display', fonts.display);
export const Title = make('title', fonts.display);
export const Heading = make('heading', fonts.heading);
export const Body = make('body');
export const Small = make('small');
export const Meta = make('meta', undefined, 'muted');

/** Sonuç ekranlarının kahramanı: büyük sayı + sessiz etiket. */
export function Stat({
  value,
  label,
  tone = 'ink',
  style,
}: {
  value: string;
  label: string;
  tone?: Tone;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.stat, style]}>
      <Display tone={tone} style={styles.statValue}>
        {value}
      </Display>
      <Meta style={styles.statLabel}>{label}</Meta>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    gap: space.xs,
  },
  statValue: {
    // Rakamlar hizalı dursun: "73%" ile "8%" alt alta kaymasın.
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    textTransform: 'uppercase',
  },
});
