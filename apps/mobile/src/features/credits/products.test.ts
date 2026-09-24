import { describe, expect, it } from 'vitest';

import {
  creditsFor,
  isProProduct,
  kindOf,
  PRO_MONTHLY_CREDITS,
  toPurchaseOptions,
  type PackageLike,
} from './products';

const pkg = (identifier: string, productId: string, price: number): PackageLike => ({
  identifier,
  product: { identifier: productId, priceString: `$${price.toFixed(2)}`, price },
});

describe('products', () => {
  it('test_credits_for_known_product_returns_amount', () => {
    expect(creditsFor('credits_10')).toBe(10);
    expect(creditsFor('credits_100')).toBe(100);
  });

  it('test_credits_for_unknown_product_returns_zero', () => {
    expect(creditsFor('credits_999')).toBe(0);
    expect(creditsFor('pro_monthly')).toBe(0);
  });

  it('test_kind_of_classifies_products', () => {
    expect(kindOf('credits_30')).toBe('credits');
    expect(kindOf('pro_yearly')).toBe('pro');
    expect(kindOf('something_else')).toBe('unknown');
    expect(isProProduct('pro_monthly')).toBe(true);
  });

  it('test_purchase_options_put_credits_first_cheapest_first', () => {
    const options = toPurchaseOptions([
      pkg('$rc_annual', 'pro_yearly', 49.99),
      pkg('big', 'credits_100', 17.99),
      pkg('$rc_monthly', 'pro_monthly', 6.99),
      pkg('small', 'credits_10', 2.99),
    ]);

    expect(options.map((option) => option.productId)).toEqual([
      'credits_10',
      'credits_100',
      'pro_monthly',
      'pro_yearly',
    ]);
  });

  it('test_purchase_options_drop_unknown_products', () => {
    const options = toPurchaseOptions([pkg('x', 'mystery_pack', 1), pkg('y', 'credits_30', 6.99)]);
    expect(options).toHaveLength(1);
    expect(options[0].credits).toBe(30);
  });

  it('test_pro_option_shows_monthly_credit_grant', () => {
    const [option] = toPurchaseOptions([pkg('$rc_monthly', 'pro_monthly', 6.99)]);
    expect(option.credits).toBe(PRO_MONTHLY_CREDITS);
    expect(option.priceString).toBe('$6.99');
  });
});
