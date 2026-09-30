import { describe, expect, it } from 'vitest';

import { createSignInTracker } from './signInTracker';

describe('createSignInTracker', () => {
  it('ilk girişte olayı gönderir', () => {
    const tracker = createSignInTracker();
    expect(tracker.shouldCapture('kullanici-1')).toBe(true);
  });

  it('aynı kullanıcı için ikinci kez ateşlenirse yutar', () => {
    // Gerçek hata buydu: INITIAL_SESSION ardından SIGNED_IN, iki olay.
    const tracker = createSignInTracker();
    tracker.shouldCapture('kullanici-1');
    expect(tracker.shouldCapture('kullanici-1')).toBe(false);
    expect(tracker.shouldCapture('kullanici-1')).toBe(false);
  });

  it('kullanıcı değişirse yeniden gönderir', () => {
    const tracker = createSignInTracker();
    tracker.shouldCapture('kullanici-1');
    expect(tracker.shouldCapture('kullanici-2')).toBe(true);
  });

  it('çıkışta olay göndermez', () => {
    const tracker = createSignInTracker();
    tracker.shouldCapture('kullanici-1');
    expect(tracker.shouldCapture(null)).toBe(false);
  });

  it('çıkıştan sonra aynı kullanıcı yeniden girerse tekrar sayılır', () => {
    const tracker = createSignInTracker();
    tracker.shouldCapture('kullanici-1');
    tracker.shouldCapture(null);
    expect(tracker.shouldCapture('kullanici-1')).toBe(true);
  });

  it('oturum hiç açılmadan gelen boş durumlar olay üretmez', () => {
    const tracker = createSignInTracker();
    expect(tracker.shouldCapture(null)).toBe(false);
    expect(tracker.shouldCapture(null)).toBe(false);
  });
});
