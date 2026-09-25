// Metin alanı. Etiket + alan + hata, hepsi tek yerde (DESIGN.md §10).
//
// Odak durumu var: yazdığın alan mürekkep çerçeveye döner. Bu süs değil — telefonda
// klavye açıkken hangi alanda olduğunu gösteren tek işaret o.
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Meta, Small } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout, radius, space, type } from '@/design/tokens';

type Props = TextInputProps & { label: string; error?: string | null };

export function TextField({ label, error, style, onFocus, onBlur, ...inputProps }: Props) {
  const colors = Colors[useColorScheme()];
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.text : colors.border;

  return (
    <View style={styles.wrapper}>
      <Meta style={styles.label}>{label}</Meta>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor,
            borderWidth: focused || error ? 2 : StyleSheet.hairlineWidth * 2,
          },
          style,
        ]}
        {...inputProps}
      />
      {error ? <Small tone="accent">{error}</Small> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: space.sm,
  },
  label: {
    textTransform: 'uppercase',
  },
  input: {
    minHeight: layout.minTouch + space.xs,
    borderRadius: radius.button,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: type.body.size,
    lineHeight: type.body.lineHeight,
  },
});
