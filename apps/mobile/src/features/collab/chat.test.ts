import { describe, expect, it } from 'vitest';

import {
  appendMessage,
  MESSAGE_MAX,
  matchName,
  messageError,
  toMatches,
  toMessage,
  toMessages,
  type Message,
} from './chat';

const matchRow = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  partner_id: 'p1',
  display_name: 'Ada',
  channel_title: 'Ada Makes Things',
  youtube_url: 'https://www.youtube.com/@ada',
  band: 'b1k_10k',
  types: ['joint_video'],
  last_message: 'hey',
  last_message_at: '2026-09-30T10:00:00Z',
  unread: '2',
  ...over,
});

const msg = (over: Partial<Message> = {}): Message => ({
  id: 1,
  matchId: 'm1',
  senderId: 'p1',
  body: 'hey',
  createdAt: '2026-09-30T10:00:00Z',
  ...over,
});

describe('collab chat', () => {
  it('test_maps_a_match_row', () => {
    const [first] = toMatches([matchRow()]);
    expect(first.id).toBe('m1');
    expect(first.partnerId).toBe('p1');
    expect(first.channelTitle).toBe('Ada Makes Things');
    expect(first.unread).toBe(2);
  });

  it('test_unread_arrives_as_a_string_and_becomes_a_number', () => {
    expect(toMatches([matchRow({ unread: '7' })])[0].unread).toBe(7);
    expect(toMatches([matchRow({ unread: 0 })])[0].unread).toBe(0);
    expect(toMatches([matchRow({ unread: null })])[0].unread).toBe(0);
  });

  it('test_a_match_row_without_ids_is_dropped', () => {
    expect(toMatches([matchRow(), { display_name: 'no ids' }])).toHaveLength(1);
  });

  it('test_a_conversation_with_no_messages_yet_is_fine', () => {
    const [first] = toMatches([matchRow({ last_message: null, last_message_at: null })]);
    expect(first.lastMessage).toBeNull();
    expect(first.lastMessageAt).toBeNull();
  });

  it('test_junk_payload_returns_an_empty_list', () => {
    expect(toMatches(null)).toEqual([]);
    expect(toMatches([null, 3])).toEqual([]);
  });

  it('test_match_name_prefers_the_channel_then_the_profile', () => {
    const [first] = toMatches([matchRow()]);
    expect(matchName(first, 'A creator')).toBe('Ada Makes Things');
    expect(matchName({ ...first, channelTitle: null }, 'A creator')).toBe('Ada');
    expect(matchName({ ...first, channelTitle: null, displayName: null }, 'A creator')).toBe(
      'A creator',
    );
  });

  it('test_append_ignores_a_message_it_already_has', () => {
    // Aynı mesaj iki yoldan gelir: send_message'ın dönüşü ve Realtime yayını.
    const list = [msg({ id: 1 })];
    expect(appendMessage(list, msg({ id: 1 }))).toBe(list);
    expect(appendMessage(list, msg({ id: 1 }))).toHaveLength(1);
  });

  it('test_append_keeps_the_list_in_time_order', () => {
    const list = [
      msg({ id: 1, createdAt: '2026-09-30T10:00:00Z' }),
      msg({ id: 3, createdAt: '2026-09-30T10:02:00Z' }),
    ];
    const next = appendMessage(list, msg({ id: 2, createdAt: '2026-09-30T10:01:00Z' }));
    expect(next.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('test_append_falls_back_to_the_id_when_two_messages_share_a_timestamp', () => {
    const list = [msg({ id: 5, createdAt: '2026-09-30T10:00:00Z' })];
    const next = appendMessage(list, msg({ id: 4, createdAt: '2026-09-30T10:00:00Z' }));
    expect(next.map((m) => m.id)).toEqual([4, 5]);
  });

  it('test_message_row_with_a_string_id_still_maps', () => {
    // Realtime yükü sayıyı string olarak verebiliyor.
    const mapped = toMessage({
      id: '12',
      match_id: 'm1',
      sender_id: 'p1',
      body: 'hi',
      created_at: '2026-09-30T10:00:00Z',
    });
    expect(mapped?.id).toBe(12);
  });

  it('test_message_row_missing_a_field_is_dropped', () => {
    expect(toMessage({ id: 1, match_id: 'm1', sender_id: 'p1' })).toBeNull();
    expect(toMessage(null)).toBeNull();
    expect(toMessages([{ id: 1 }, null])).toEqual([]);
  });

  it('test_empty_message_cannot_be_sent', () => {
    expect(messageError('')).toBe('empty');
    expect(messageError('   \n ')).toBe('empty');
    expect(messageError('hi')).toBeNull();
  });

  it('test_message_length_matches_the_database_check', () => {
    expect(messageError('a'.repeat(MESSAGE_MAX))).toBeNull();
    expect(messageError('a'.repeat(MESSAGE_MAX + 1))).toBe('too_long');
  });
});
