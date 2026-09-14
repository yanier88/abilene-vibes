const plan = (name, amountCents, displayPrice) => Object.freeze({
  name, amountCents, displayPrice, price: displayPrice,
  interval: amountCents ? 'month' : null,
  cadence: amountCents ? 'per month' : 'forever',
  note: amountCents ? `Monthly subscription. ${displayPrice} today, then auto-renews until canceled.` : 'Basic directory listing',
});

export const ANDROID_PROMOTION_CATALOG = Object.freeze([
  plan('Free', 0, '$0'), plan('Featured', 2499, '$24.99'), plan('Premium', 6799, '$67.99'),
]);
const LEGACY_PROMOTION_CATALOG = Object.freeze([
  plan('Free', 0, '$0'), plan('Featured', 1900, '$19'), plan('Premium', 5900, '$59'),
]);
export const promotionPlansFor = platform => platform === 'android' ? ANDROID_PROMOTION_CATALOG : LEGACY_PROMOTION_CATALOG;
export const promotionPriceFor = (platform, name) => {
  const selected = promotionPlansFor(platform).find(plan => plan.name === name);
  if (!selected) throw new Error('Unknown promotion plan');
  return selected.displayPrice;
};

export function promotionCheckoutPayload(platform, body) {
  if (!body || !['Featured', 'Premium'].includes(body.plan)) throw new Error('Checkout requires a paid promotion plan');
  for (const key of ['amount', 'amountCents', 'unit_amount', 'price', 'priceId', 'price_id', 'catalog']) {
    if (Object.hasOwn(body, key)) throw new Error('Client pricing overrides are not allowed');
  }
  return platform === 'android' ? { ...body, catalog: 'android_v2' } : { ...body };
}
