import { describe, expect, it, vi } from 'vitest';

import { buildCaptureBody, createAnalytics } from './analytics';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('analytics', () => {
  it('test_analytics_without_key_sends_nothing', async () => {
    const fetchImpl = vi.fn();
    const analytics = createAnalytics({ fetchImpl: fetchImpl as unknown as typeof fetch });

    analytics.capture('review_submitted');
    await flush();

    expect(analytics.enabled).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('test_analytics_posts_named_event_with_distinct_id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const analytics = createAnalytics({
      key: 'phc_test',
      host: 'https://eu.i.posthog.com/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => new Date('2026-09-24T10:00:00.000Z'),
    });

    analytics.identify('user-1');
    analytics.capture('submission_created', { requested: 5 });
    await flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://eu.i.posthog.com/capture/');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      api_key: 'phc_test',
      event: 'submission_created',
      distinct_id: 'user-1',
      timestamp: '2026-09-24T10:00:00.000Z',
      properties: { requested: 5, $lib: 'clickable-app' },
    });
  });

  it('test_analytics_reset_drops_the_identified_user', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const analytics = createAnalytics({
      key: 'phc_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    analytics.identify('user-1');
    analytics.reset();
    analytics.capture('signed_in');
    await flush();

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    // Çıkış yapan kullanıcının olayları bir sonraki kullanıcıya yapışmamalı.
    expect(body.distinct_id).not.toBe('user-1');
    expect(body.distinct_id).toMatch(/^anon-/);
  });

  it('test_analytics_failure_never_reaches_the_caller', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const onError = vi.fn();
    const analytics = createAnalytics({
      key: 'phc_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onError,
    });

    expect(() => analytics.capture('task_started')).not.toThrow();
    await flush();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('test_capture_body_carries_no_free_form_identity', () => {
    const body = buildCaptureBody({
      key: 'phc_test',
      event: 'purchase',
      distinctId: 'user-1',
      properties: { product: 'credits_30' },
      timestamp: '2026-09-24T10:00:00.000Z',
    });

    // Kişisel veri göndermiyoruz: e-posta, kanal adresi, başlık metni yok.
    expect(Object.keys(body.properties)).toEqual(['product', '$lib']);
  });
});
