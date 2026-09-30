// Profil ekranındaki Collab bölümü (F1).
//
// Kendi bileşeni, çünkü profil ekranı zaten 400 satırın üstünde ve buraya bir taslak
// durumu daha eklemek onu okunmaz hâle getirirdi (CreditHistory ile aynı gerekçe).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Section } from '@/components/Section';
import { TextField } from '@/components/TextField';
import { Label, Meta, Small } from '@/components/Type';
import { space } from '@/design/tokens';
import { t, type MessageKey } from '@/i18n';

import { collabProfileQueryKey, saveCollabProfile, useCollabProfile } from '../api';
import {
  BIO_MAX,
  COLLAB_TYPES,
  collabProfileChanged,
  collabProfileError,
  normalizeBio,
  toggleType,
  type CollabProfile,
} from '../rules';

export function CollabSettings({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const saved = useCollabProfile(userId);

  // Taslak yalnızca kullanıcı bir şeye dokununca doğar; `null` iken ekranda sunucudaki
  // hâl görünür. Profil ekranındaki "also review" bölümüyle aynı desen — böylece başka
  // bir cihazda yapılan değişiklik, buraya dokunulmadığı sürece kendiliğinden yansır.
  const [draft, setDraft] = useState<CollabProfile | null>(null);
  const current: CollabProfile = draft ?? saved.data ?? { isOpen: false, types: [], bio: null };

  // Bio'nun ham hâli ayrı tutuluyor: kullanıcı yazarken her tuşta trim edersek boşluk
  // tuşu çalışmıyormuş gibi olur. Kırpma kaydederken yapılır.
  const [bioText, setBioText] = useState<string | null>(null);
  const bioValue = bioText ?? current.bio ?? '';

  const update = (next: Partial<CollabProfile>) => setDraft({ ...current, ...next });

  const pending: CollabProfile = { ...current, bio: normalizeBio(bioValue) };
  const error = collabProfileError(pending);
  const dirty = saved.data ? collabProfileChanged(saved.data, pending) : draft !== null;

  const save = useMutation({
    mutationFn: () => saveCollabProfile(userId, pending),
    onSuccess: async () => {
      setDraft(null);
      setBioText(null);
      await queryClient.invalidateQueries({ queryKey: collabProfileQueryKey(userId) });
    },
  });

  if (saved.isPending) {
    return (
      <Section title={t('profile.collab.title')}>
        <ActivityIndicator />
      </Section>
    );
  }

  return (
    <Section title={t('profile.collab.title')}>
      <Small tone="muted">{t('profile.collab.body')}</Small>

      <View style={styles.chips}>
        <Chip
          role="checkbox"
          label={t('profile.collab.open')}
          selected={current.isOpen}
          onPress={() => update({ isOpen: !current.isOpen })}
        />
      </View>
      <Meta>{t('profile.collab.openHint')}</Meta>

      {/*
        Türler ve bio yalnızca açıkken gösteriliyor: kapalı bir profilde bunları doldurmak
        hiçbir şey yapmaz ve "doldurdum ama kimse görmüyor" şikâyetini doğurur.
      */}
      {current.isOpen ? (
        <>
          <Label style={styles.label}>{t('profile.collab.types')}</Label>
          <View style={styles.chips}>
            {COLLAB_TYPES.map((type) => (
              <Chip
                key={type}
                role="checkbox"
                label={t(`profile.collab.kinds.${type}` as MessageKey)}
                selected={current.types.includes(type)}
                onPress={() => update({ types: toggleType(current.types, type) })}
              />
            ))}
          </View>

          <TextField
            label={t('profile.collab.bio')}
            placeholder={t('profile.collab.bioPlaceholder')}
            value={bioValue}
            onChangeText={setBioText}
            multiline
            style={styles.bio}
            error={
              error === 'too_long' ? t('profile.collab.errors.too_long', { max: BIO_MAX }) : null
            }
          />
          <Meta>
            {t('profile.collab.bioCount', { used: bioValue.trim().length, max: BIO_MAX })}
          </Meta>
        </>
      ) : null}

      {error === 'no_type' ? (
        <Small tone="accent">{t('profile.collab.errors.no_type')}</Small>
      ) : null}

      {/*
        Kaydetme düşerse (ağ, RLS, enum) kullanıcı bunu GÖRMELİ. İlk hâlinde yalnızca
        `loading` vardı: istek düşünce düğme "Save" olarak kalıyordu ve hiçbir şey
        söylemiyordu — kullanıcı kaydettiğini sanıp ekrandan çıkardı.
      */}
      {save.isError ? <Small tone="accent">{t('profile.collab.errors.save_failed')}</Small> : null}

      <Button
        title={dirty ? t('profile.collab.save') : t('profile.collab.saved')}
        onPress={() => save.mutate()}
        disabled={!dirty || error !== null}
        loading={save.isPending}
      />

      {/*
        Desteye giden TEK yol bu (Collab sekme değil). Yalnızca kaydedilmiş ve açık bir
        profil için gösteriliyor: kapalıyken basan kişi "profilini aç" ekranına düşerdi,
        yani düğme onu gönderdiği yerde geri çeviren bir düğme olurdu. Taslak varken de
        gizli — kaydedilmemiş bir seçimle desteye gitmek, seçimi kaybetmek demek.
      */}
      {saved.data?.isOpen && !dirty ? (
        <>
          <Button
            title={t('profile.collab.browse')}
            variant="secondary"
            onPress={() => router.push('/collab')}
          />
          <Button
            title={t('profile.collab.matches')}
            variant="secondary"
            onPress={() => router.push('/collab/matches')}
          />
        </>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: space.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  bio: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
