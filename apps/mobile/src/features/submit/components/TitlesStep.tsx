import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Small, Title } from '@/components/Type';
import { TextField } from '@/components/TextField';
import { space } from '@/design/tokens';
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
      <Title>{t('submit.wizard.titlesTitle')}</Title>
      <Small tone="muted">{t('submit.wizard.titlesHint')}</Small>

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
    gap: space.md,
  },
});
