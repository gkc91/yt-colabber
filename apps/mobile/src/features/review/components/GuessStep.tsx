import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Heading, Meta } from '@/components/Type';
import { TextField } from '@/components/TextField';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
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
      {/* Başlık YouTube'daki gibi durur: burada da ölçtüğümüz şey vaat (DESIGN.md §2). */}
      <Heading>{title}</Heading>

      <TextField
        label={t('review.guess.question')}
        placeholder={t('review.guess.placeholder')}
        value={guess}
        onChangeText={onChange}
        multiline
        maxLength={300}
      />
      <Meta>{t('review.guess.words', { words, min: MIN_GUESS_WORDS })}</Meta>

      <Button title={t('review.next')} onPress={onContinue} disabled={!isGuessLongEnough(guess)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
