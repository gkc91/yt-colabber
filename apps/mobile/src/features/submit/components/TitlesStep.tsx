import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Text, View } from '@/components/Themed';
import { t } from '@/i18n';

import { MAX_TITLE_LENGTH, MAX_TITLES } from '../rules';

type Props = {
  titles: string[];
  onChange: (titles: string[]) => void;
};

export function TitlesStep({ titles, onChange }: Props) {
  const setTitle = (index: number, value: string) =>
    onChange(titles.map((title, i) => (i === index ? value : title)));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('submit.wizard.titlesTitle')}</Text>
      <Text style={styles.hint}>{t('submit.wizard.titlesHint')}</Text>

      {titles.map((title, index) => (
        <TextField
          key={index}
          label={`${index + 1}`}
          placeholder={t('submit.wizard.titlePlaceholder')}
          value={title}
          onChangeText={(value) => setTitle(index, value)}
          maxLength={MAX_TITLE_LENGTH}
          multiline
        />
      ))}

      {titles.length < MAX_TITLES ? (
        <Button
          title={t('submit.wizard.addTitle')}
          variant="secondary"
          onPress={() => onChange([...titles, ''])}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  hint: {
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.7,
  },
});
