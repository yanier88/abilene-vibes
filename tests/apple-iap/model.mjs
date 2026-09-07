// LOCAL LAB ONLY. No network, SQL, credentials, SDK, frontend imports or real JWS.
// A committed snapshot models durability; it is NOT a database durability test.
const LIVE_INTENTS = new Set(['reserved', 'purchasing', 'pending', 'verifying', 'reconciliation']);
const LIVE_SUBS = new Set(['active', 'active_nonrenewing', 'grace', 'billing_retry', 'reconciliation']);
const PURCHASE_EVENTS = new Set(['INITIAL_BUY', 'DID_RENEW', 'RESUBSCRIBE']);
const EVENTS = new Set([...PURCHASE_EVENTS, 'DID_CHANGE_RENEWAL_STATUS', 'DID_FAIL_TO_RENEW', 'GRACE_PERIOD_EXPIRED', 'EXPIRED', 'REFUND', 'REVOKE']);
const copy = value => structuredClone(value);
const fail = reason => { throw new Error(reason); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const chainKey = e => `${e.environment}|${e.originalTransactionId}`;
const txnKey = e => `${e.environment}|${e.transactionId}`;
export class SlotLab {
  constructor({ mode = 'permanent', buyers = [], listings = [], snapshot, diagnosticUnsafeHypothesis = false } = {}) {
    this.state = snapshot ? copy(snapshot) : {
      mode, diagnosticUnsafeHypothesis, now: 100, nextId: 0, buyers: copy(buyers), listings: copy(listings),
      intents: [], episodes: [], subscriptions: [], transactions: [], notifications: [],
      deliveries: [], unresolved: [], reconciled: [], audit: [],
    };
    if (!['permanent', 'episodes'].includes(this.state.mode)) fail('INVALID_MODEL');
  }
  snapshot() { return copy(this.state); }
  // Synchronous copy-on-write = serialized local transaction, not DB locking.
  atomic(operation, crashBeforeCommit = false) {
    const previous = this.state;
    this.state = copy(previous);
    try {
      const result = operation();
      if (crashBeforeCommit) fail('BACKEND_CRASH_BEFORE_COMMIT');
      this.assertInvariants();
      return copy(result);
    } catch (error) { this.state = previous; throw error; }
  }
  id(prefix) { return `${prefix}-${++this.state.nextId}`; }
  advance(now) { if (now < this.state.now) fail('CLOCK_BACKWARDS'); this.state.now = now; }
  buyer(id) { return this.state.buyers.find(b => b.id === id) ?? fail('UNKNOWN_BUYER'); }
  intent(id) { return this.state.intents.find(i => i.id === id) ?? fail('UNKNOWN_INTENT'); }
  slotState(buyerId, slot) {
    const unresolved = this.state.unresolved.some(x => x.buyerId === buyerId && x.slot === slot);
    if (unresolved) return 'reconciliation';
    if (this.state.subscriptions.some(s => s.buyerId === buyerId && s.slot === slot && LIVE_SUBS.has(s.status))) return 'occupied';
    if (this.state.intents.some(i => i.buyerId === buyerId && i.slot === slot && LIVE_INTENTS.has(i.status))) return 'reserved';
    return this.state.episodes.some(a => a.buyerId === buyerId && a.slot === slot && a.subscriptionKey) ? 'candidate_for_reuse' : 'available';
  }
  canReuseSlot(buyerId, slot) {
    this.buyer(buyerId);
    const state = this.slotState(buyerId, slot);
    if (['reserved', 'occupied', 'reconciliation'].includes(state)) return { reusable: false, reason: state };
    if (state === 'available') return { reusable: true, reason: 'NO_ASSIGNMENT_HISTORY' };
    // Even a reconciled expired history cannot rule out an external resubscribe.
    return { reusable: false, reason: 'HISTORICAL_CHAIN_CAN_REACTIVATE' };
  }
  prepare({ buyerId, listingId, plan = 'premium', slot, idempotencyKey, experimentalReuse = false }) {
    return this.atomic(() => {
      this.buyer(buyerId);
      if (!idempotencyKey || !['featured', 'premium'].includes(plan)) fail('INVALID_REQUEST');
      const request = { listingId, plan, slot: slot ?? null, experimentalReuse };
      const existing = this.state.intents.find(i => i.buyerId === buyerId && i.idempotencyKey === idempotencyKey);
      if (existing) { if (!same(existing.request, request)) fail('IDEMPOTENCY_CONFLICT'); return existing; }
      const listing = this.state.listings.find(l => l.id === listingId);
      if (!listing?.authorizedBuyers.includes(buyerId) || !listing.visible) fail('LISTING_NOT_AUTHORIZED');
      if (this.state.intents.some(i => i.listingId === listingId && LIVE_INTENTS.has(i.status)) ||
          this.state.episodes.some(a => a.listingId === listingId && a.status === 'active')) fail('LISTING_CONFLICT');
      const slots = slot === undefined ? Array.from({ length: 10 }, (_, i) => i + 1) : [slot];
      const selected = slots.find(n => Number.isInteger(n) && n >= 1 && n <= 10 &&
        (this.canReuseSlot(buyerId, n).reusable || (experimentalReuse && this.state.mode === 'episodes' &&
          this.slotState(buyerId, n) === 'candidate_for_reuse' && this.state.reconciled.includes(`${buyerId}|${n}`))));
      if (!selected) fail('NO_SAFE_SLOT');
      const intent = { id: this.id('intent'), buyerId, listingId, listingType: listing.type, plan,
        slot: selected, productId: `TEST.slot.${selected}.${plan}`, idempotencyKey, request,
        status: 'reserved', expiresAt: this.state.now + 10, experimentalReuse };
      this.state.intents.push(intent);
      this.state.episodes.push({ id: this.id('episode'), intentId: intent.id, buyerId, slot: selected,
        listingId, listingType: listing.type, status: 'prepared', subscriptionKey: null,
        createdAt: this.state.now, firstPurchaseDate: null, closures: [] });
      return intent;
    });
  }
  start(id) { return this.transition(id, ['reserved'], 'purchasing', true); }
  pending(id) { return this.transition(id, ['purchasing'], 'pending'); }
  verifying(id) { return this.transition(id, ['purchasing', 'pending'], 'verifying'); }
  transition(id, from, to, checkExpiry = false) {
    return this.atomic(() => {
      const i = this.intent(id);
      if (!from.includes(i.status)) fail('INVALID_INTENT_TRANSITION');
      if (checkExpiry && this.state.now > i.expiresAt) fail('INTENT_EXPIRED');
      i.status = to; return i;
    });
  }
  terminate(id, status, definitiveNoPurchase = false) {
    return this.atomic(() => {
      const i = this.intent(id);
      if (!['canceled', 'failed'].includes(status) || !LIVE_INTENTS.has(i.status)) fail('INVALID_INTENT_TRANSITION');
      if (i.status !== 'reserved' && !definitiveNoPurchase) fail('PURCHASE_MAY_STILL_COMPLETE');
      i.status = status;
      this.state.episodes.find(a => a.intentId === id).status = 'closed';
      return i;
    });
  }
  validate(e) {
    if (e.fixtureKind !== 'TEST/SYNTHETIC' || e.verification !== 'SIMULATED_ACCEPTED') fail('NOT_SYNTHETIC_VERIFIED');
    if (e.bundleId !== 'TEST.local.apple-iap' || e.environment !== 'Sandbox') fail('WRONG_ENVIRONMENT_OR_APP');
    if (!EVENTS.has(e.type) || !e.notificationId || !e.transactionId || !e.originalTransactionId) fail('INVALID_EVENT');
    if (![e.purchaseDate, e.expiresDate, e.signedDate].every(Number.isFinite) || e.expiresDate <= e.purchaseDate) fail('INVALID_DATES');
    const match = /^TEST\.slot\.(\d+)\.(featured|premium)$/.exec(e.productId);
    const slot = Number(match?.[1]);
    if (!match || slot < 1 || slot > 10 || e.subscriptionGroupIdentifier !== `TEST.group.${slot}`) fail('WRONG_PRODUCT');
    const buyer = this.state.buyers.find(b => b.appTransactionId === e.appTransactionId && b.environment === e.environment);
    if (!buyer || e.appAccountToken !== buyer.appAccountToken) fail('WRONG_BUYER');
    return { buyer, slot, plan: match[2] };
  }
  resolveTransactionToAssignment(e, intentId) {
    const { buyer, slot } = this.validate(e);
    const known = this.state.transactions.find(t => t.key === txnKey(e));
    if (known?.episodeId) return { status: 'RESOLVED', episodeId: known.episodeId, basis: 'EXACT_TRANSACTION' };
    const sub = this.state.subscriptions.find(s => s.key === chainKey(e));
    if (sub && (sub.buyerId !== buyer.id || sub.slot !== slot)) fail('CHAIN_IDENTITY_CONFLICT');
    const activeIntents = this.state.intents.filter(i => i.buyerId === buyer.id && i.slot === slot && ['purchasing', 'pending', 'verifying'].includes(i.status));
    const intent = intentId ? this.intent(intentId) : activeIntents.length === 1 ? activeIntents[0] : null;
    if (intent && (intent.buyerId !== buyer.id || intent.slot !== slot)) fail('INTENT_IDENTITY_CONFLICT');
    if (sub) {
      const a = this.state.episodes.find(x => x.id === sub.episodeId);
      const other = this.state.episodes.some(x => x.buyerId === buyer.id && x.slot === slot &&
        x.id !== a.id && ['prepared', 'active', 'reconciliation'].includes(x.status));
      const isNewPeriod = PURCHASE_EVENTS.has(e.type) && !this.state.transactions.some(t => t.key === txnKey(e));
      if ((intent && intent.listingId !== a.listingId) || (other && isNewPeriod)) {
        return { status: 'RECONCILIATION_REQUIRED', reason: 'OLD_CHAIN_VS_NEW_ASSIGNMENT' };
      }
      return { status: 'RESOLVED', episodeId: a.id, basis: 'HISTORICAL_CHAIN' };
    }
    if (!intent || !['purchasing', 'pending', 'verifying'].includes(intent.status) || !['INITIAL_BUY', 'RESUBSCRIBE'].includes(e.type)) {
      return { status: 'RECONCILIATION_REQUIRED', reason: 'NO_UNIQUE_STARTED_INTENT' };
    }
    if (intent.productId !== e.productId) fail('WRONG_PRODUCT_FOR_INTENT');
    const previousListing = this.state.episodes.some(a => a.buyerId === buyer.id && a.slot === slot && a.subscriptionKey && a.listingId !== intent.listingId);
    if (previousListing && !this.state.diagnosticUnsafeHypothesis) {
      return { status: 'RECONCILIATION_REQUIRED', reason: 'NEW_CHAIN_DOES_NOT_PROVE_NEW_LISTING_INTENT' };
    }
    // This is the experimental assumption under test, not Apple-signed intent binding.
    const episode = this.state.episodes.find(a => a.intentId === intent.id);
    return { status: 'RESOLVED', episodeId: episode.id, basis: 'UNIQUE_INTENT_CANDIDATE',
      assumption: 'No concurrent external purchase produced this unknown chain' };
  }
  ingest(e, { intentId, crashBeforeCommit = false, loseResponse = false } = {}) {
    const result = this.atomic(() => {
      const { buyer, slot, plan } = this.validate(e);
      if (intentId && this.intent(intentId).buyerId !== buyer.id) fail('WRONG_BUYER');
      const previous = this.state.notifications.find(n => n.id === e.notificationId);
      if (previous) { if (!same(previous.event, e)) fail('NOTIFICATION_PAYLOAD_CONFLICT'); return previous.result; }
      const stored = this.state.transactions.find(t => t.key === txnKey(e));
      const facts = { appTransactionId: e.appTransactionId, chain: chainKey(e), productId: e.productId, purchaseDate: e.purchaseDate, expiresDate: e.expiresDate };
      if (stored && !same(stored.facts, facts)) fail('TRANSACTION_PAYLOAD_CONFLICT');
      let resolution = this.resolveTransactionToAssignment(e, intentId);
      if (resolution.status === 'RESOLVED') {
        const resolvedEpisode = this.state.episodes.find(x => x.id === resolution.episodeId);
        const listing = this.state.listings.find(l => l.id === resolvedEpisode.listingId);
        if (!listing?.visible) resolution = { status: 'RECONCILIATION_REQUIRED', reason: 'LISTING_UNAVAILABLE' };
      }
      if (resolution.status !== 'RESOLVED') {
        if (!stored) this.state.transactions.push({ key: txnKey(e), facts, episodeId: null });
        this.state.unresolved.push({ event: copy(e), buyerId: buyer.id, slot, reason: resolution.reason });
        if (intentId) { this.intent(intentId).status = 'reconciliation';
          this.state.episodes.find(a => a.intentId === intentId).status = 'reconciliation'; }
        const r = { status: 'RECONCILIATION_REQUIRED', reason: resolution.reason };
        this.state.notifications.push({ id: e.notificationId, event: copy(e), result: r }); return r;
      }
      const a = this.state.episodes.find(x => x.id === resolution.episodeId);
      let sub = this.state.subscriptions.find(s => s.key === chainKey(e));
      if (!sub) {
        sub = { key: chainKey(e), buyerId: buyer.id, slot, episodeId: a.id, events: [], status: 'reconciliation' };
        this.state.subscriptions.push(sub); a.subscriptionKey = sub.key;
      }
      if (sub.episodeId !== a.id) fail('IMMUTABLE_ASSIGNMENT');
      if (a.firstPurchaseDate === null) a.firstPurchaseDate = e.purchaseDate;
      if (!stored) this.state.transactions.push({ key: txnKey(e), facts, episodeId: a.id });
      else stored.episodeId = a.id;
      sub.events.push(copy(e));
      // Event reduction uses signed synthetic facts, never receipt arrival time.
      // Apple production additionally needs authoritative Server API reconciliation.
      const purchases = sub.events.filter(x => PURCHASE_EVENTS.has(x.type));
      const latestPurchase = purchases.sort((x, y) => x.purchaseDate - y.purchaseDate || x.signedDate - y.signedDate).at(-1);
      const relevant = sub.events.filter(x => x.transactionId === latestPurchase?.transactionId);
      const latest = relevant.sort((x, y) => x.signedDate - y.signedDate).at(-1);
      const revoked = relevant.some(x => ['REFUND', 'REVOKE'].includes(x.type));
      sub.expiresDate = latestPurchase?.expiresDate ?? e.expiresDate;
      sub.plan = latestPurchase?.productId.split('.').at(-1) ?? plan;
      sub.status = revoked ? 'revoked' : ({
        INITIAL_BUY: 'active', RESUBSCRIBE: 'active', DID_RENEW: 'active',
        DID_CHANGE_RENEWAL_STATUS: latest?.autoRenew === false ? 'active_nonrenewing' : 'active',
        DID_FAIL_TO_RENEW: latest?.graceExpiresDate > this.state.now ? 'grace' : 'billing_retry',
        GRACE_PERIOD_EXPIRED: 'billing_retry', EXPIRED: 'expired',
      }[latest?.type] ?? 'reconciliation');
      sub.graceExpiresDate = latest?.graceExpiresDate ?? null;
      a.status = ['expired', 'revoked'].includes(sub.status) ? 'closed' : 'active';
      if (a.status === 'closed' && !a.closures.some(c => c.transactionId === e.transactionId && c.type === e.type && c.signedDate === e.signedDate)) {
        a.closures.push({ transactionId: e.transactionId, type: e.type, signedDate: e.signedDate });
      }
      this.state.reconciled = this.state.reconciled.filter(k => k !== `${buyer.id}|${slot}`);
      const i = this.state.intents.find(x => x.id === a.intentId);
      if (i) i.status = 'completed';
      this.state.audit.push({ type: 'PERSIST_TRANSACTION_ASSOCIATION_ENTITLEMENT', transactionId: e.transactionId, episodeId: a.id });
      const eligibleDelivery = ['active', 'active_nonrenewing', 'grace'].includes(sub.status) &&
        (sub.status === 'grace' ? sub.graceExpiresDate : sub.expiresDate) > this.state.now;
      if (eligibleDelivery && !this.state.deliveries.some(d => d.key === txnKey(e))) {
        this.state.deliveries.push({ key: txnKey(e), episodeId: a.id, buyerId: buyer.id, receipt: `TEST-DELIVERED:${txnKey(e)}` });
      }
      const receipt = this.state.deliveries.find(d => d.key === txnKey(e));
      const r = { status: receipt ? 'DELIVERED' : 'RECORDED', receipt: receipt?.receipt, episodeId: a.id, basis: resolution.basis, assumption: resolution.assumption };
      this.state.notifications.push({ id: e.notificationId, event: copy(e), result: r }); return r;
    }, crashBeforeCommit);
    if (loseResponse) fail('RESPONSE_LOST_AFTER_COMMIT');
    return result;
  }
  delivery(transactionId, buyerId) {
    return copy(this.state.deliveries.find(d => d.key === `Sandbox|${transactionId}` && d.buyerId === buyerId) ?? null);
  }
  // Synthetic authoritative terminal snapshot, NOT a call to Apple.
  reconcileTerminal(buyerId, slot) {
    return this.atomic(() => {
      if (this.state.unresolved.some(x => x.buyerId === buyerId && x.slot === slot) ||
          this.state.intents.some(i => i.buyerId === buyerId && i.slot === slot && LIVE_INTENTS.has(i.status))) fail('UNRESOLVED_PURCHASE');
      const subs = this.state.subscriptions.filter(s => s.buyerId === buyerId && s.slot === slot);
      if (!subs.length || subs.some(s => !['expired', 'revoked'].includes(s.status))) fail('NOT_TERMINAL');
      const key = `${buyerId}|${slot}`;
      if (!this.state.reconciled.includes(key)) this.state.reconciled.push(key);
      return { status: 'candidate_for_reuse', safe: this.canReuseSlot(buyerId, slot).reusable };
    });
  }
  restore(buyerId, evidence) {
    return evidence.flatMap(e => {
      const { buyer } = this.validate(e);
      if (buyer.id !== buyerId) fail('WRONG_BUYER');
      const sub = this.state.subscriptions.find(s => s.key === chainKey(e));
      if (sub && sub.buyerId !== buyer.id) fail('CHAIN_IDENTITY_CONFLICT');
      if (!sub || !['active', 'active_nonrenewing', 'grace'].includes(sub.status) ||
          (sub.status === 'grace' ? sub.graceExpiresDate : sub.expiresDate) <= this.state.now) return [];
      const a = this.state.episodes.find(x => x.id === sub.episodeId);
      return [{ episodeId: a.id, listingId: a.listingId, plan: sub.plan, editorialPermission: false }];
    }).filter((x, i, all) => all.findIndex(y => y.episodeId === x.episodeId) === i);
  }
  assertInvariants() {
    const unique = (rows, key) => { if (new Set(rows.map(key)).size !== rows.length) fail('INVARIANT_DUPLICATE'); };
    unique(this.state.transactions, x => x.key); unique(this.state.deliveries, x => x.key);
    unique(this.state.subscriptions, x => x.key); unique(this.state.notifications, x => x.id);
    unique(this.state.episodes.filter(x => x.status === 'active'), x => `${x.buyerId}|${x.slot}`);
    unique(this.state.episodes.filter(x => x.status === 'active'), x => x.listingId);
    for (const d of this.state.deliveries) {
      if (!this.state.transactions.some(t => t.key === d.key && t.episodeId === d.episodeId) ||
          !this.state.episodes.some(a => a.id === d.episodeId)) fail('DELIVERY_WITHOUT_PERSISTENCE');
    }
  }
}
