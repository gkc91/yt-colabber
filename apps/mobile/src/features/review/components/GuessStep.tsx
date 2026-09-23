import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { t } from '@/i18n';

import { countWords, isGuessLongEnough, MIN_GUESS_WORDS } from '../rules';

type Props = {
  thumbnailUrl: string;
  title: string;
  guess: string;
  onChange: (guess: string) => void;
  onContinue: () => void;
};

/** Adım 2 — vaat testi: thumbnail + başlık, "bu video ne hakkında?" (PRODUCT §5). */
export function GuessStep({ thumbnailUrl, title, guess, onChange, onContinue }: Props) {
  const colors = Colors[useColorScheme()];
  const words = countWords(guess);

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: thumbnailUrl }}
        style={[styles.thumbnail, { borderColor: colors.border }]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.title}>{title}</Text>

      <TextField
        label={t('review.guess.question')}
        placeholder={t('review.guess.placeholder')}
        value={guess}
        onChangeText={onChange}
        multiline
        maxLength={300}
      />
      <Text style={[styles.counter, { color: colors.muted }]}>
        {t('review.guess.words', { words, min: MIN_GUESS_WORDS })}
      </Text>

      <Button title={t('review.next')} onPress={onContinue} disabled={!isGuessLongEnough(guess)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  counter: {
    fontSize: 13,
  },
});
