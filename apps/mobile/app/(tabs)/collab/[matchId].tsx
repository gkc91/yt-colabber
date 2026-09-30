// Sohbet (F3). PRODUCT §12 — Collab krediye BAĞLANMAZ; bu ekranda bakiye okunmaz.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { Body, Heading, Meta, Small } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import {
  blockCandidate,
  CollabError,
  markRead,
  matchesQueryKey,
  messagesQueryKey,
  reportMessage,
  sendMessage,
  subscribeToMessages,
  useMatches,
  useMessages,
} from '@/features/collab/api';
import {
  appendMessage,
  matchName,
  messageError,
  MESSAGE_MAX,
  toMessage,
  type Message,
} from '@/features/collab/chat';
import { t, type MessageKey } from '@/i18n';
import { confirmDestructive } from '@/lib/confirm';

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const id = typeof matchId === 'string' ? matchId : '';
  const { session } = useSession();
  const me = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const colors = Colors[useColorScheme()];

  const matches = useMatches();
  const match = useMemo(() => (matches.data ?? []).find((m) => m.id === id), [matches.data, id]);

  // Başlık kimle konuşulduğunu söylüyor. Rota gizli bir sekme ekranı olduğu için başlık
  // sekme seçeneklerinden geliyor ve sabit kalırdı: bir sohbetin içindeyken tepede
  // "Matches" yazması, hangi konuşmada olduğunuzu ekranda hiçbir yerde söylemez.
  const navigation = useNavigation();
  useEffect(() => {
    if (match) navigation.setOptions({ title: matchName(match, t('collab.card.unnamed')) });
  }, [match, navigation]);
  const history = useMessages(id);

  // Canlı gelenler ayrı tutuluyor ve okunanla birleştiriliyor: sorguyu her mesajda
  // geçersiz kılmak, açık bir sohbette saniyede bir ağ turu demek olurdu.
  const [live, setLive] = useState<Message[]>([]);
  const messages = useMemo(() => {
    let list = history.data ?? [];
    for (const message of live) list = appendMessage(list, message);
    return list;
  }, [history.data, live]);

  const [draft, setDraft] = useState('');
  const error = messageError(draft);

  useEffect(() => {
    if (!id) return;
    return subscribeToMessages(id, (row) => {
      const message = toMessage(row);
      if (message) setLive((current) => appendMessage(current, message));
    });
  }, [id]);

  // Sohbeti açmak okundu demektir; listedeki rozet de tazelenmeli.
  useEffect(() => {
    if (!id) return;
    markRead(id)
      .then(() => queryClient.invalidateQueries({ queryKey: matchesQueryKey }))
      .catch(() => {
        /* okundu işareti düşerse sohbet yine de çalışır */
      });
  }, [id, messages.length, queryClient]);

  const send = useMutation({
    mutationFn: () => sendMessage(id, draft),
    onSuccess: async () => {
      setDraft('');
      // Kendi mesajımız Realtime'dan da gelir; `appendMessage` kimliğe göre tekilleştirdiği
      // için iki kez görünmüyor. Yine de sorguyu tazeliyoruz: yayın düşerse mesaj
      // kaybolmuş gibi görünmesin.
      await queryClient.invalidateQueries({ queryKey: messagesQueryKey(id) });
    },
  });

  // Hangi mesajların raporlandığı TEK TEK tutuluyor. İlk hâlinde yalnızca
  // `report.isSuccess` bakılıyordu ve bir mesajı raporlamak, sohbetteki BÜTÜN mesajların
  // etiketini "Reported" yapıyordu — kullanıcı hepsini raporladığını sanırdı.
  const [reported, setReported] = useState<number[]>([]);
  const report = useMutation({
    mutationFn: (message: Message) => reportMessage(message.id, 'reported from chat'),
    onSuccess: (_result, message) => setReported((list) => [...list, message.id]),
  });

  // Engelleme SOHBETTEN de yapılabilmeli. İlk hâlinde yalnızca aday destesinde vardı,
  // yani eşleştikten sonra rahatsız eden biriyle karşılaşan kişinin hiçbir çıkışı yoktu —
  // rapor bir insanın bakmasını sağlar ama konuşmayı o an kesmez.
  const block = useMutation({
    mutationFn: (partnerId: string) => blockCandidate(partnerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: matchesQueryKey });
      router.replace('/collab/matches');
    },
  });

  const confirmBlock = async (partnerId: string, partnerName: string) => {
    const ok = await confirmDestructive({
      title: t('collab.block.title', { name: partnerName }),
      message: t('collab.block.body'),
      confirmLabel: t('collab.block.confirm'),
      cancelLabel: t('collab.block.cancel'),
    });
    if (ok) block.mutate(partnerId);
  };

  const confirmReport = async (message: Message) => {
    const ok = await confirmDestructive({
      title: t('collab.chat.report.title'),
      message: t('collab.chat.report.body'),
      confirmLabel: t('collab.chat.report.confirm'),
      cancelLabel: t('collab.block.cancel'),
    });
    if (ok) report.mutate(message);
  };

  if (history.isPending || matches.isPending) {
    return (
      <Screen center>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (history.isError) {
    const code = history.error instanceof CollabError ? history.error.code : 'unknown';
    return (
      <Screen>
        <Heading>{t('collab.chat.errorTitle')}</Heading>
        <Body>{code === 'blocked' ? t('collab.chat.blocked') : t('collab.error.body')}</Body>
      </Screen>
    );
  }

  // Eşleşme listede yoksa engellenmiş ya da silinmiş demektir (0044: engellenen eşleşme
  // `collab_matches_list`'ten ve `messages` politikasından birlikte düşüyor).
  if (!match) {
    return (
      <Screen>
        <Heading>{t('collab.chat.goneTitle')}</Heading>
        <Body>{t('collab.chat.goneBody')}</Body>
      </Screen>
    );
  }

  const name = matchName(match, t('collab.card.unnamed'));

  return (
    <Screen
      footer={
        <View style={styles.composer}>
          <TextField
            label={t('collab.chat.field', { name })}
            placeholder={t('collab.chat.placeholder')}
            value={draft}
            onChangeText={setDraft}
            multiline
            style={styles.input}
            error={error === 'too_long' ? t('collab.chat.tooLong', { max: MESSAGE_MAX }) : null}
          />
          {send.isError ? (
            <Small tone="accent">
              {t(
                `collab.chat.errors.${
                  send.error instanceof CollabError && send.error.code !== 'collab_closed'
                    ? send.error.code
                    : 'unknown'
                }` as MessageKey,
              )}
            </Small>
          ) : null}
          <Button
            title={t('collab.chat.send')}
            onPress={() => send.mutate()}
            disabled={error !== null || send.isPending}
            loading={send.isPending}
          />
          {/*
            Engelleme ikincil ve altta: sohbet ekranının işi konuşmak, kapatmak değil.
            Ama BULUNMAK ZORUNDA — rapor bir insanın bakmasını sağlar, konuşmayı o an
            kesmez ve eşleştikten sonra rahatsız eden biriyle karşılaşan kişinin başka
            çıkışı yok.
          */}
          <Button
            title={t('collab.chat.block')}
            variant="secondary"
            disabled={block.isPending}
            onPress={() => confirmBlock(match.partnerId, name)}
          />
        </View>
      }
    >
      <Meta>{t('collab.chat.intro', { name })}</Meta>
      {report.isError ? <Small tone="accent">{t('collab.chat.reportFailed')}</Small> : null}

      {messages.length === 0 ? (
        <Body>{t('collab.chat.empty', { name })}</Body>
      ) : (
        messages.map((message) => {
          const mine = message.senderId === me;
          return (
            <View
              key={message.id}
              accessibilityRole="text"
              accessibilityLabel={t(
                mine ? 'collab.chat.fromMe' : ('collab.chat.fromThem' as MessageKey),
                { name, body: message.body },
              )}
              style={[
                styles.bubble,
                mine
                  ? { alignSelf: 'flex-end', backgroundColor: colors.surface }
                  : { alignSelf: 'flex-start', backgroundColor: colors.background },
                { borderColor: colors.border },
              ]}
            >
              <Body>{message.body}</Body>
              {/* Rapor yalnızca KARŞI tarafın mesajında: sunucu kendi mesajını
                  raporlamayı zaten reddediyor (0044), düğmeyi de göstermeyelim. */}
              {!mine ? (
                <Pressable
                  accessibilityRole="button"
                  // Metin boyutunda bir dokunma alanı parmakla ıskalanır. `hitSlop`
                  // `TextProps`'ta yok, o yüzden sarmalayıcı bir Pressable — uygulamadaki
                  // diğer metin düğmeleriyle aynı desen (ReportSheet, ThumbnailsStep).
                  hitSlop={space.sm}
                  onPress={() => confirmReport(message)}
                >
                  <Meta>
                    {reported.includes(message.id)
                      ? t('collab.chat.reported')
                      : t('collab.chat.report.action')}
                  </Meta>
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  composer: {
    gap: space.sm,
  },
  input: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  bubble: {
    maxWidth: '85%',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.xs,
  },
});
