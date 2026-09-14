const catalogs = Object.freeze({
  legacy: Object.freeze({
    Featured: { amount: 1900, env: 'STRIPE_FEATURED_PRICE_ID' },
    Premium: { amount: 5900, env: 'STRIPE_PREMIUM_PRICE_ID' },
  }),
  android_v2: Object.freeze({
    Featured: { amount: 2499, env: 'STRIPE_ANDROID_FEATURED_PRICE_ID' },
    Premium: { amount: 6799, env: 'STRIPE_ANDROID_PREMIUM_PRICE_ID' },
  }),
});
export class PricingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function resolvePricing(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PricingError('Invalid checkout request');
  const catalog = body.catalog === undefined ? 'legacy' : body.catalog;
  if (typeof catalog !== 'string' || !Object.hasOwn(catalogs, catalog)) throw new PricingError('Unknown promotion catalog');
  if (typeof body.plan !== 'string' || !Object.hasOwn(catalogs[catalog], body.plan)) throw new PricingError('Unknown paid promotion plan');
  for (const field of ['amount', 'amountCents', 'unit_amount', 'price', 'priceId', 'price_id']) {
    if (Object.hasOwn(body, field)) throw new PricingError('Client pricing overrides are not allowed');
  }
  return Object.freeze({ catalog, plan: body.plan, ...catalogs[catalog][body.plan], currency: 'usd', interval: 'month', quantity: 1 });
}
export function validateAndroidPrice(price, expected, id) {
  if (price?.id !== id || price.active !== true || price.currency !== expected.currency ||
      price.unit_amount !== expected.amount || price.type !== 'recurring' ||
      price.recurring?.interval !== expected.interval || price.recurring?.interval_count !== 1 ||
      price.recurring?.usage_type !== 'licensed' || price.billing_scheme !== 'per_unit' || price.transform_quantity != null) {
    throw new PricingError('Configured Android Price does not match the required monthly catalog', 503);
  }
}
export async function resolveLineItem(pricing, getEnv, secretKey, fetcher = fetch) {
  const id = (getEnv(pricing.env) ?? '').trim();
  if (id && pricing.catalog === 'android_v2') {
    if (!/^price_[A-Za-z0-9]+$/.test(id)) throw new PricingError('Invalid Android Price ID configuration', 503);
    let response;
    try {
      response = await fetcher(`https://api.stripe.com/v1/prices/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
    } catch { throw new PricingError('Android Price verification unavailable', 503); }
    if (!response.ok) throw new PricingError('Android Price verification failed', 503);
    let price;
    try { price = await response.json(); } catch { throw new PricingError('Android Price verification failed', 503); }
    validateAndroidPrice(price, pricing, id);
  }
  return Object.freeze({ ...pricing, priceId: id });
}
export function applyLineItem(params, pricing, name, description) {
  params.set('line_items[0][quantity]', String(pricing.quantity));
  if (pricing.catalog === 'android_v2') {
    params.set('metadata[catalog]', pricing.catalog);
    params.set('subscription_data[metadata][catalog]', pricing.catalog);
  }
  if (pricing.priceId) params.set('line_items[0][price]', pricing.priceId);
  else {
    params.set('line_items[0][price_data][currency]', pricing.currency);
    params.set('line_items[0][price_data][unit_amount]', String(pricing.amount));
    params.set('line_items[0][price_data][recurring][interval]', pricing.interval);
    params.set('line_items[0][price_data][product_data][name]', name);
    params.set('line_items[0][price_data][product_data][description]', description);
  }
}
