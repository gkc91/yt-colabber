import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type Props = TextInputProps & { label: string; error?: string | null };

export function TextField({ label, error, style, ...inputProps }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          { color: colors.text, borderColor: error ? colors.danger : colors.border },
          style,
        ]}
        {...inputProps}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: {
    fontSize: 13,
  },
});
