import { resolvePricing } from "../create-checkout-session/pricing.mjs";
const id = (x) => (typeof x === "string" ? x : x?.id);
export const authorityEventTypes = new Set([
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);
export function eventSubscription(event) {
  const o = event.data?.object;
  return event.type.startsWith("customer.subscription.")
    ? id(o)
    : id(o?.subscription || o?.parent?.subscription_details?.subscription);
}
// Input is an authenticated server-to-Stripe GET, never a client assertion.
export function subscriptionAuthority(event, sub, getEnv = () => "") {
  if (
    !authorityEventTypes.has(event.type) ||
    !event.id ||
    !Number.isInteger(event.created) ||
    event.created <= 0 ||
    eventSubscription(event) !== sub?.id ||
    event.livemode !== sub.livemode
  )
    throw Error("STRIPE_AUTHORITY_INVALID");
  const meta = sub.metadata ?? {};
  const kind = meta.listing_type || "business";
  const listing = meta.submission_id || meta.job_id || meta.rental_id;
  if (
    !["business", "job", "rental"].includes(kind) ||
    !/^[0-9a-f-]{36}$/i.test(listing ?? "")
  )
    throw Error("STRIPE_BINDING_INVALID");
  let priceValid = false;
  try {
    const expected = resolvePricing({ plan: meta.plan, catalog: meta.catalog });
    const items = sub.items?.data ?? [],
      price = items[0]?.price;
    const configured = getEnv(expected.env);
    priceValid =
      items.length === 1 &&
      items[0].quantity === 1 &&
      price?.currency === "usd" &&
      price?.recurring?.interval === "month" &&
      (price.recurring.interval_count ?? 1) === 1 &&
      !sub.pause_collection &&
      (configured
        ? price.id === configured
        : price.unit_amount === expected.amount);
  } catch {
    /* unknown pricing fails closed */
  }
  const rawPeriod =
    sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  const boundaries = [rawPeriod, sub.cancel_at, sub.ended_at].filter(
    Number.isInteger,
  );
  const period = Number.isInteger(rawPeriod) ? Math.min(...boundaries) : null;
  const terminal =
    event.type === "customer.subscription.deleted" ||
    sub.status === "canceled" ||
    sub.status === "incomplete_expired";
  const status = terminal
    ? "canceled"
    : !priceValid || !Number.isInteger(period)
      ? "unverified"
      : event.type === "invoice.payment_failed"
        ? "past_due"
        : sub.status;
  return {
    event_id: event.id,
    event_created: event.created,
    subscription_id: sub.id,
    listing_type: kind,
    listing_id: listing,
    plan:
      meta.plan?.toLowerCase() === "premium"
        ? "premium"
        : meta.plan?.toLowerCase() === "featured"
          ? "featured"
          : "free",
    status,
    period_end: Number.isInteger(period)
      ? new Date(period * 1000).toISOString()
      : null,
    cancel_at_period_end: sub.cancel_at_period_end === true,
    environment: sub.livemode === true ? "Production" : "Sandbox",
  };
}
