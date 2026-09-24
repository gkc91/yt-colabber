import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/Button';
import { Rule } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Display, Meta, Small } from '@/components/Type';
import { TextField } from '@/components/TextField';
import { space } from '@/design/tokens';
import { sendMagicLink, signInWithGoogle } from '@/features/auth/api';
import { t } from '@/i18n';

const emailSchema = z.email();

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const magicLink = useMutation({ mutationFn: sendMagicLink });
  const google = useMutation({ mutationFn: signInWithGoogle });

  const onSendLink = () => {
    if (!emailSchema.safeParse(email.trim()).success) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    setEmailError(null);
    magicLink.mutate(email);
  };

  const error = magicLink.error ?? google.error;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen gap={space.xl} style={styles.page}>
        {/* Ad üstte ve büyük; ortalanmış bir şablon girişi değil (DESIGN.md §6). */}
        <View style={styles.header}>
          <Display>{t('auth.title')}</Display>
          <Body tone="muted">{t('auth.tagline')}</Body>
        </View>
        <Rule />

        {magicLink.isSuccess ? (
          <View style={styles.section}>
            <Body>{t('auth.linkSent')}</Body>
            <Button
              title={t('auth.useAnotherEmail')}
              variant="secondary"
              onPress={() => magicLink.reset()}
            />
          </View>
        ) : (
          <View style={styles.section}>
            <TextField
              label={t('auth.emailLabel')}
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              error={emailError}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="send"
              onSubmitEditing={onSendLink}
            />
            <Button title={t('auth.sendLink')} onPress={onSendLink} loading={magicLink.isPending} />
          </View>
        )}

        <Meta style={styles.or}>{t('auth.or')}</Meta>
        <Button
          title={t('auth.google')}
          variant="secondary"
          onPress={() => google.mutate()}
          loading={google.isPending}
        />

        {error ? <Small tone="accent">{error.message || t('auth.genericError')}</Small> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  page: {
    paddingTop: space.xxxl,
  },
  header: {
    gap: space.md,
  },
  section: {
    gap: space.md,
  },
  or: {
    textTransform: 'uppercase',
  },
});
