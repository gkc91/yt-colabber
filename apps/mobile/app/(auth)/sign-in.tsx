import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Text, View } from '@/components/Themed';
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.title')}</Text>
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
        </View>

        {magicLink.isSuccess ? (
          <View style={styles.section}>
            <Text style={styles.notice}>{t('auth.linkSent')}</Text>
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

        <Text style={styles.or}>{t('auth.or')}</Text>
        <Button
          title={t('auth.google')}
          variant="secondary"
          onPress={() => google.mutate()}
          loading={google.isPending}
        />

        {error ? <Text style={styles.error}>{error.message || t('auth.genericError')}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  tagline: {
    fontSize: 16,
    lineHeight: 22,
  },
  section: {
    gap: 12,
  },
  notice: {
    fontSize: 16,
    lineHeight: 22,
  },
  or: {
    textAlign: 'center',
    opacity: 0.6,
  },
  error: {
    color: '#c62828',
    textAlign: 'center',
  },
});
