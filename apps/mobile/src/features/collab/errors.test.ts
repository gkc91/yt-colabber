import { describe, expect, it } from 'vitest';

import { toCollabError } from './errors';

// Supabase hata mesajları sunucunun `raise exception` metnini sarmalayarak veriyor;
// testler o gerçek biçimi taklit ediyor.
const pgError = (code: string) => ({ message: `${code}` });
const wrapped = (code: string) => ({ message: `unexpected error: ${code} (SQLSTATE P0001)` });

describe('collab errors', () => {
  it('test_each_server_code_maps_to_itself', () => {
    for (const code of [
      'collab_closed',
      'blocked',
      'daily_limit',
      'not_in_match',
      'own_message',
    ] as const) {
      expect(toCollabError(pgError(code)).code).toBe(code);
      expect(toCollabError(wrapped(code)).code).toBe(code);
    }
  });

  it('test_an_unknown_message_falls_back_to_unknown', () => {
    expect(toCollabError({ message: 'connection reset' }).code).toBe('unknown');
    expect(toCollabError(null).code).toBe('unknown');
    expect(toCollabError(undefined).code).toBe('unknown');
    expect(toCollabError({}).code).toBe('unknown');
  });

  it('test_a_message_carrying_two_codes_picks_the_specific_one', () => {
    // Sıralama önemli: "blocked" kelimesi başka bir cümlenin içinde de geçebilir ve
    // önce eşleşen kazanır. Günlük sınıra takılan birine "bu sohbet kapalı" demek,
    // ona yanlış şeyi düzeltmeye çalıştırır.
    expect(toCollabError({ message: 'daily_limit reached, not blocked' }).code).toBe('daily_limit');
    expect(toCollabError({ message: 'not_in_match: blocked pair' }).code).toBe('not_in_match');
  });

  it('test_the_error_is_a_real_error_so_it_survives_a_throw', () => {
    const error = toCollabError(pgError('daily_limit'));
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('daily_limit');
  });
});
