import { describe, expect, it, vi } from 'vitest';

import { waitForCredits } from './purchaseFlow';

const noSleep = async () => {};

describe('waitForCredits', () => {
  it('test_wait_returns_credited_as_soon_as_balance_rises', async () => {
    const readBalance = vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(35);

    const result = await waitForCredits({ readBalance, previous: 5, sleep: noSleep });

    expect(result).toEqual({ outcome: 'credited', balance: 35 });
    expect(readBalance).toHaveBeenCalledTimes(2);
  });

  it('test_wait_returns_pending_when_webhook_never_lands', async () => {
    const readBalance = vi.fn().mockResolvedValue(5);

    const result = await waitForCredits({
      readBalance,
      previous: 5,
      attempts: 3,
      sleep: noSleep,
    });

    expect(result).toEqual({ outcome: 'pending', balance: 5 });
    expect(readBalance).toHaveBeenCalledTimes(3);
  });

  it('test_wait_survives_a_failing_read', async () => {
    const readBalance = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(12);

    const result = await waitForCredits({
      readBalance,
      previous: 2,
      attempts: 3,
      sleep: noSleep,
    });

    expect(result.outcome).toBe('credited');
    expect(result.balance).toBe(12);
  });

  it('test_wait_sleeps_between_attempts_but_not_after_the_last', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const readBalance = vi.fn().mockResolvedValue(0);

    await waitForCredits({ readBalance, previous: 0, attempts: 3, sleep });

    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
