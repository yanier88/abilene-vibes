// TEST/SYNTHETIC ONLY. These objects are not JWS and prove nothing about Apple.
export const BUYER = Object.freeze({ id: 'buyer-X', appTransactionId: 'TEST-app-X', appAccountToken: 'TEST-token-X', environment: 'Sandbox' });
export const OTHER = Object.freeze({ id: 'buyer-Y', appTransactionId: 'TEST-app-Y', appAccountToken: 'TEST-token-Y', environment: 'Sandbox' });
export const listings = () => [
  { id: 'A', type: 'business', authorizedBuyers: ['buyer-X'], visible: true },
  { id: 'B', type: 'business', authorizedBuyers: ['buyer-X'], visible: true },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `L${i}`, type: i % 2 ? 'job' : 'rental', authorizedBuyers: ['buyer-X'], visible: true })),
];
export const product = (slot, plan = 'premium') => `TEST.slot.${slot}.${plan}`;
export function event(overrides = {}) {
  return {
    fixtureKind: 'TEST/SYNTHETIC', verification: 'SIMULATED_ACCEPTED',
    notificationId: 'notification-1', type: 'INITIAL_BUY',
    bundleId: 'TEST.local.apple-iap', environment: 'Sandbox',
    appTransactionId: BUYER.appTransactionId, appAccountToken: BUYER.appAccountToken,
    originalTransactionId: 'chain-1', transactionId: 'txn-1',
    productId: product(3), subscriptionGroupIdentifier: 'TEST.group.3',
    purchaseDate: 100, expiresDate: 200, signedDate: 100,
    ...overrides,
  };
}
