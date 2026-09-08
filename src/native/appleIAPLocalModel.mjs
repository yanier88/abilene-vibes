// In-memory laboratory state, not an entitlement/ownership authority.
export const LOCAL_PRODUCTS = [
  'com.abilenevibes.app.promotion.slot01.featured.monthly',
  'com.abilenevibes.app.promotion.slot01.premium.monthly',
  'com.abilenevibes.app.promotion.slot02.featured.monthly',
];
export function localEntryEnabled(buildFlag, native, platform) {
  return buildFlag === 'true' && native === true && platform === 'ios';
}
export function verifiedLocalGate(result) {
  return result?.status === 'verified' && result.localTestEnabled === true &&
    result.proof?.verification === 'verified' && result.proof.environment === 'Xcode' &&
    result.proof.bundleId === 'com.abilenevibes.app';
}
export function safeEvent(event) {
  if (event?.status !== 'verified') return { status: event?.status ?? 'error', errorCode: event?.errorCode };
  const p = event.proof;
  return { status: 'verified', transactionId: p.transactionId, originalTransactionId: p.originalTransactionId,
    productId: p.productId, environment: p.environment, group: p.subscriptionGroupIdentifier,
    expiresDate: p.expiresDate, isUpgraded: p.isUpgraded, purchaseDate: p.purchaseDate };
}
export function mergeKnown(known, events, source) {
  const next = Object.fromEntries(Object.entries(known).map(([id, entry]) => [id, { ...entry }]));
  const entitlementSnapshot = source === 'entitlements' || source === 'sync entitlements';
  const unfinishedSnapshot = source === 'unfinished' || source === 'sync unfinished';
  const pendingEvidence = ['purchase', 'transactionUpdate', 'unfinished', 'sync unfinished'].includes(source);
  const valid = events.filter(e => e.status === 'verified' && e.proof?.environment === 'Xcode' &&
    e.proof.verification === 'verified' && e.proof.bundleId === 'com.abilenevibes.app' && LOCAL_PRODUCTS.includes(e.proof.productId));
  const present = new Set(valid.map(e => e.proof.transactionId));
  for (const entry of Object.values(next)) {
    if (entitlementSnapshot) entry.entitlementActive = false;
    if (unfinishedSnapshot && entry.knownPendingFinish && !present.has(entry.transactionId)) entry.reconciliationRequired = true;
  }
  for (const event of valid) {
    const safe = safeEvent(event), old = next[safe.transactionId];
    const explicitlyFinished = old?.explicitlyFinished ?? false;
    next[safe.transactionId] = { ...old, ...safe,
      delivery: old?.delivery ?? 'pending delivery / not confirmed finished',
      knownPendingFinish: !explicitlyFinished && ((old?.knownPendingFinish ?? false) || pendingEvidence),
      entitlementActive: entitlementSnapshot ? !safe.isUpgraded && (safe.expiresDate == null || safe.expiresDate > Date.now()) : old?.entitlementActive ?? false,
      recoveredAfterSync: (old?.recoveredAfterSync ?? false) || source.startsWith('sync '),
      explicitlyFinished,
      reconciliationRequired: explicitlyFinished ? unfinishedSnapshot : pendingEvidence ? false : old?.reconciliationRequired ?? true,
      sources: [...new Set([...(old?.sources ?? []), source])] };
  }
  return next; // No absence ever authorizes finish; active entitlement != unfinished.
}
export function localConfirmation(event) {
  const c = event.localDeliveryConfirmation;
  return event.status === 'verified' && event.proof.environment === 'Xcode' &&
    c?.transactionId === event.proof.transactionId && typeof c.receipt === 'string' && c.receipt.startsWith('XCODE-TEST.') ? c : null;
}
export function markExplicitFinish(known, result) {
  if (result?.finished !== true || !known[result.transactionId]) throw new Error('finish not confirmed');
  return { ...known, [result.transactionId]: { ...known[result.transactionId], delivery: 'explicitly finished (bridge response)', knownPendingFinish: false, explicitlyFinished: true, reconciliationRequired: false } };
}
