// Aday destesi (F2). PRODUCT §12.
//
// SEKME DEĞİL, gizli rota: giriş noktası profildeki Collab bölümü. Dördüncü bir sekme
// açmak, kuzey yıldızı "submission başına ilk 24 saatteki değerlendirme" olan bir
// uygulamada dikkati krediyle hiç ilgisi olmayan bir modüle kaydırırdı. Collab'ı açan
// kişi zaten onu açtığı ekrandan buraya geliyor.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Heading, Meta, Small } from '@/components/Type';
import { space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import {
  blockCandidate,
  candidatesQueryKey,
  CollabError,
  likeCandidate,
  passCandidate,
  useCandidates,
  useCollabProfile,
} from '@/features/collab/api';
import { candidateName, removeCandidate, type Candidate } from '@/features/collab/candidates';
import { CandidateCard } from '@/features/collab/components/CandidateCard';
import { t } from '@/i18n';
import { confirmDestructive } from '@/lib/confirm';

export default function CollabScreen() {
  const { session } = useSession();
  const userId = session?.user.id as string;
  const queryClient = useQueryClient();

  const profile = useCollabProfile(userId);
  const isOpen = profile.data?.isOpen ?? false;
  const deck = useCandidates(profile.isSuccess && isOpen);

  // Deste istemcide tükeniyor: karar verilen kart listeden çıkıyor ve sunucuya yeniden
  // sorulmuyor. Her karardan sonra `collab_candidates` çağırmak, karar sunucuya işlenene
  // kadar aynı kişiyi geri getirme riski taşır ve gereksiz gidip gelmedir.
  const [decided, setDecided] = useState<string[]>([]);
  const [matched, setMatched] = useState<{ candidate: Candidate; matchId: string } | null>(null);

  const cards = (deck.data ?? []).filter((c) => !decided.includes(c.id));
  const current = cards[0] ?? null;
  const remaining = current ? removeCandidate(cards, current.id).length : 0;

  const decide = (id: string) => setDecided((list) => [...list, id]);

  const like = useMutation({
    mutationFn: (candidate: Candidate) => likeCandidate(candidate.id),
    onSuccess: (matchId, candidate) => {
      decide(candidate.id);
      if (matchId) setMatched({ candidate, matchId });
    },
  });

  const pass = useMutation({
    mutationFn: (candidate: Candidate) => passCandidate(candidate.id),
    onSuccess: (_result, candidate) => decide(candidate.id),
  });

  const block = useMutation({
    mutationFn: (candidate: Candidate) => blockCandidate(candidate.id),
    onSuccess: (_result, candidate) => {
      decide(candidate.id);
      // Engelleme aday listesini de değiştirir (karşı taraf artık hiç çıkmamalı);
      // desteyi tazelemek için anahtarı geçersiz kıl.
      queryClient.invalidateQueries({ queryKey: candidatesQueryKey });
    },
  });

  const busy = like.isPending || pass.isPending || block.isPending;

  const confirmBlock = async (candidate: Candidate) => {
    const name = candidateName(candidate, t('collab.card.unnamed'));
    // Onay soruluyor çünkü yanlış düğmeye basmak karşı tarafı destenden çıkarır ve
    // ikinizi birbirinize kapatır. `Alert.alert` DEĞİL: web'de hiçbir şey yapmıyor ve
    // düğme ölü kalıyordu (tarayıcı testinde yakalandı, bkz. lib/confirm.ts).
    const ok = await confirmDestructive({
      title: t('collab.block.title', { name }),
      message: t('collab.block.body'),
      confirmLabel: t('collab.block.confirm'),
      cancelLabel: t('collab.block.cancel'),
    });
    if (ok) block.mutate(candidate);
  };

  if (profile.isPending) {
    return (
      <Screen center>
        <ActivityIndicator />
      </Screen>
    );
  }

  // Profil kapalıysa deste hiç istenmiyor: sunucu zaten `collab_closed` fırlatırdı ve
  // kullanıcıya bir hata göstermek, ona ne yapması gerektiğini söylemekten kötüdür.
  if (!isOpen) {
    return (
      <Screen>
        <Heading>{t('collab.closed.title')}</Heading>
        <Body>{t('collab.closed.body')}</Body>
        <Button title={t('collab.closed.cta')} onPress={() => router.push('/profile')} />
      </Screen>
    );
  }

  if (deck.isPending) {
    return (
      <Screen center>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (deck.isError) {
    const code = deck.error instanceof CollabError ? deck.error.code : 'unknown';
    return (
      <Screen>
        <Heading>{t('collab.error.title')}</Heading>
        <Body>{code === 'collab_closed' ? t('collab.closed.body') : t('collab.error.body')}</Body>
        <Button title={t('collab.error.retry')} onPress={() => deck.refetch()} />
      </Screen>
    );
  }

  if (matched) {
    const name = candidateName(matched.candidate, t('collab.card.unnamed'));
    return (
      <Screen>
        <Card gap={space.md}>
          <Heading>{t('collab.match.title')}</Heading>
          <Body>{t('collab.match.body', { name })}</Body>
        </Card>
        {/* Sohbet birincil eylem: eşleşmenin karşılığı konuşmak. */}
        <Button
          title={t('collab.match.openChat')}
          onPress={() =>
            router.push({
              pathname: '/collab/[matchId]',
              params: { matchId: matched.matchId },
            })
          }
        />
        <Button
          title={t('collab.match.keepBrowsing')}
          variant="secondary"
          onPress={() => setMatched(null)}
        />
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen>
        <Heading>{t('collab.empty.title')}</Heading>
        <Body>{t('collab.empty.body')}</Body>
        <Button
          title={t('collab.empty.refresh')}
          variant="secondary"
          onPress={() => {
            setDecided([]);
            deck.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <View style={styles.row}>
            <View style={styles.half}>
              <Button
                title={t('collab.actions.pass')}
                variant="secondary"
                disabled={busy}
                onPress={() => pass.mutate(current)}
              />
            </View>
            <View style={styles.half}>
              <Button
                title={t('collab.actions.like')}
                disabled={busy}
                loading={like.isPending}
                onPress={() => like.mutate(current)}
              />
            </View>
          </View>
          <Button
            title={t('collab.actions.block')}
            variant="secondary"
            disabled={busy}
            onPress={() => confirmBlock(current)}
          />
        </View>
      }
    >
      <Small tone="muted">{t('collab.intro')}</Small>
      <CandidateCard candidate={current} />
      {/* Son karttayken "0 more after this one" yazmak bilgi değil gürültü. */}
      {remaining > 0 ? <Meta>{t('collab.remaining', { count: remaining })}</Meta> : null}
      {like.isError || pass.isError || block.isError ? (
        <Small tone="accent">{t('collab.error.action')}</Small>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  half: {
    flex: 1,
  },
});
