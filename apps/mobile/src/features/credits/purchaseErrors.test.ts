import { describe, expect, it } from 'vitest';

import { PurchaseError } from '@/lib/purchases.types';

import { purchaseErrorKey } from './purchaseErrors';

describe('purchaseErrorKey', () => {
  it('test_cancelled_purchase_shows_no_error', () => {
    // Kullanıcı mağaza ekranını kapattı: bu bir hata değil, ekranda kırmızı yazı çıkmamalı.
    expect(purchaseErrorKey(new PurchaseError('cancelled'))).toBeNull();
  });

  it('test_known_purchase_errors_keep_their_code', () => {
    expect(purchaseErrorKey(new PurchaseError('web_unsupported'))).toBe('web_unsupported');
    expect(purchaseErrorKey(new PurchaseError('not_configured'))).toBe('not_configured');
    expect(purchaseErrorKey(new PurchaseError('store_error'))).toBe('store_error');
  });

  it('test_unknown_failure_falls_back_to_store_error', () => {
    expect(purchaseErrorKey(new Error('boom'))).toBe('store_error');
    expect(purchaseErrorKey(null)).toBe('store_error');
  });
});
