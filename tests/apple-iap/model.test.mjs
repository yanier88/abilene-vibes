import test from 'node:test';
import assert from 'node:assert/strict';
import { SlotLab } from './model.mjs';
import { BUYER, OTHER, event, listings, product } from './fixtures.mjs';
import { SimulatedStoreKit, SimulatedAttest, requestHash } from './ports.mjs';

const lab = (mode, diagnosticUnsafeHypothesis = false) => new SlotLab({ mode, diagnosticUnsafeHypothesis, buyers: [BUYER, OTHER], listings: listings() });
const prepare = (m, overrides = {}) => m.prepare({ buyerId: BUYER.id, listingId: 'A', slot: 3, idempotencyKey: 'k1', ...overrides });
function buy(m, overrides = {}) {
  const i = prepare(m, overrides); m.start(i.id);
  const e = event({ productId: i.productId, subscriptionGroupIdentifier: `TEST.group.${i.slot}`, ...overrides.event });
  const reply = m.ingest(e, { intentId: i.id }); return { i, e, reply };
}
const change = (m, e, type, extra = {}) => m.ingest({ ...e, type, notificationId: `${type}-${extra.signedDate ?? 150}`, signedDate: 150, ...extra });
const sub = m => m.state.subscriptions[0];
function expired(mode = 'episodes', diagnosticUnsafeHypothesis = false) {
  const m = lab(mode, diagnosticUnsafeHypothesis); const { i, e } = buy(m);
  const renewal1 = event({ type: 'DID_RENEW', notificationId: 'renew1', transactionId: 'txn-2', purchaseDate: 200, expiresDate: 300, signedDate: 200 });
  m.ingest(renewal1);
  const last = event({ type: 'DID_RENEW', notificationId: 'renew2', transactionId: 'txn-3', purchaseDate: 300, expiresDate: 400, signedDate: 300 });
  m.ingest(last);
  change(m, last, 'DID_CHANGE_RENEWAL_STATUS', { signedDate: 350, autoRenew: false });
  m.advance(401); change(m, last, 'EXPIRED', { signedDate: 401 });
  m.reconcileTerminal(BUYER.id, 3); m.advance(1000);
  return { m, i, e, last };
}
function reuse(m) {
  const i = prepare(m, { listingId: 'B', idempotencyKey: 'reuse', experimentalReuse: true });
  m.start(i.id); return i;
}
const rebuy = overrides => event({ type: 'RESUBSCRIBE', notificationId: 'rebuy', originalTransactionId: 'chain-2', transactionId: 'txn-B', purchaseDate: 1000, expiresDate: 1100, signedDate: 1000, ...overrides });

test('01 primera compra: persistencia antes de DELIVERED y finish explícito', () => {
  const m = lab(); const i = prepare(m); m.start(i.id); const s = new SimulatedStoreKit(); const e = s.purchase(event());
  assert.throws(() => s.finishTransaction(e.transactionId), /FINISH_BEFORE/);
  const r = m.ingest(e, { intentId: i.id });
  assert.equal(r.status, 'DELIVERED'); assert.equal(m.state.transactions.length, 1);
  assert.equal(m.state.audit[0].type, 'PERSIST_TRANSACTION_ASSOCIATION_ENTITLEMENT');
  s.confirmDelivery(e.transactionId, r, m, BUYER.id); s.finishTransaction(e.transactionId);
  assert.equal(s.store.finished.size, 1); assert.equal(s.store.charges, 1);
});
test('02 renovación conserva asociación, usa expiresDate y no suma meses', () => {
  const m = lab(); const { reply } = buy(m);
  m.ingest(event({ type: 'DID_RENEW', notificationId: 'r', transactionId: 't2', purchaseDate: 200, expiresDate: 300, signedDate: 200 }));
  assert.equal(sub(m).episodeId, reply.episodeId); assert.equal(sub(m).expiresDate, 300);
  assert.equal(m.state.episodes.filter(x => x.status === 'active').length, 1);
});
test('03 cancelación auto-renew conserva período y bloquea slot', () => {
  const m = lab(); const { e } = buy(m); change(m, e, 'DID_CHANGE_RENEWAL_STATUS', { autoRenew: false });
  assert.equal(sub(m).status, 'active_nonrenewing'); assert.equal(m.restore(BUYER.id, [e]).length, 1);
  assert.equal(m.canReuseSlot(BUYER.id, 3).reusable, false);
});
test('04 expiración reconciliada no certifica reutilización', () => {
  const { m } = expired(); assert.equal(sub(m).status, 'expired');
  assert.equal(m.slotState(BUYER.id, 3), 'candidate_for_reuse');
  assert.deepEqual(m.canReuseSlot(BUYER.id, 3), { reusable: false, reason: 'HISTORICAL_CHAIN_CAN_REACTIVATE' });
});
test('05 gracia conserva derecho y bloquea reutilización', () => {
  const m = lab(); const { e } = buy(m); m.advance(201);
  change(m, e, 'DID_FAIL_TO_RENEW', { signedDate: 201, graceExpiresDate: 220 });
  assert.equal(sub(m).status, 'grace'); assert.equal(m.restore(BUYER.id, [e]).length, 1);
  assert.equal(m.canReuseSlot(BUYER.id, 3).reusable, false);
});
test('06 billing retry no concede derecho ni libera slot', () => {
  const m = lab(); const { e } = buy(m); m.advance(201); change(m, e, 'DID_FAIL_TO_RENEW', { signedDate: 201 });
  assert.equal(sub(m).status, 'billing_retry'); assert.deepEqual(m.restore(BUYER.id, [e]), []);
  assert.equal(m.canReuseSlot(BUYER.id, 3).reusable, false);
});
for (const [n, type] of [[7, 'REFUND'], [8, 'REVOKE']]) test(`${n.toString().padStart(2, '0')} ${type} revoca únicamente su derecho`, () => {
  const m = lab(); const { e } = buy(m); change(m, e, type);
  assert.equal(sub(m).status, 'revoked'); assert.deepEqual(m.restore(BUYER.id, [e]), []);
  assert.equal(m.state.episodes[0].listingId, 'A');
});
test('09 replay con otro notificationId no duplica transacción ni entrega', () => {
  const m = lab(); const { e } = buy(m); m.ingest({ ...e, notificationId: 'replay' });
  assert.equal(m.state.transactions.length, 1); assert.equal(m.state.deliveries.length, 1);
});
test('10 notificación duplicada idempotente', () => {
  const m = lab(); const { e, reply } = buy(m); assert.deepEqual(m.ingest(e), reply);
  assert.equal(m.state.notifications.length, 1);
});
test('11 evento antiguo fuera de orden no pisa renovación nueva', () => {
  const m = lab(); const { e } = buy(m);
  m.ingest(event({ type: 'DID_RENEW', notificationId: 'r', transactionId: 't2', purchaseDate: 200, expiresDate: 300, signedDate: 200 }));
  change(m, e, 'EXPIRED', { signedDate: 199 });
  assert.equal(sub(m).status, 'active'); assert.equal(sub(m).expiresDate, 300);
});
test('12 caída antes de commit después de cobro: rollback, retry, una entrega', () => {
  const m = lab(); const i = prepare(m); m.start(i.id); const s = new SimulatedStoreKit(); const e = s.purchase(event());
  assert.throws(() => m.ingest(e, { intentId: i.id, crashBeforeCommit: true }), /BACKEND_CRASH/);
  assert.equal(m.state.transactions.length, 0); assert.equal(m.state.deliveries.length, 0);
  assert.throws(() => s.finishTransaction(e.transactionId), /FINISH_BEFORE/);
  const r = m.ingest(e, { intentId: i.id }); s.confirmDelivery(e.transactionId, r, m, BUYER.id); s.finishTransaction(e.transactionId);
  assert.equal(s.store.charges, 1); assert.equal(m.state.deliveries.length, 1);
});
test('13 app cerrada antes de finish, reabre desde snapshot y confirma sin recomprar', () => {
  const m = lab(); const i = prepare(m); m.start(i.id); const first = new SimulatedStoreKit(); const e = first.purchase(event());
  m.ingest(e, { intentId: i.id });
  const restarted = new SlotLab({ snapshot: m.snapshot() }); const second = new SimulatedStoreKit(first.store);
  assert.throws(() => second.finishTransaction(e.transactionId), /FINISH_BEFORE/);
  const r = restarted.ingest(e); second.confirmDelivery(e.transactionId, r, restarted, BUYER.id); second.finishTransaction(e.transactionId);
  assert.equal(first.store.charges, 1); assert.equal(restarted.state.deliveries.length, 1);
});
test('14 restore no requiere estado local y no concede edición', () => {
  const m = lab(); const { e } = buy(m); const recovered = new SlotLab({ snapshot: m.snapshot() });
  const rows = recovered.restore(BUYER.id, [e, e]); assert.equal(rows.length, 1);
  assert.equal(rows[0].listingId, 'A'); assert.equal(rows[0].editorialPermission, false);
});
test('15 dos promociones simultáneas independientes', () => {
  const m = lab(); buy(m); buy(m, { listingId: 'B', slot: 4, idempotencyKey: 'b', event: { transactionId: 'b', originalTransactionId: 'b', notificationId: 'b' } });
  assert.equal(m.state.episodes.filter(x => x.status === 'active').length, 2);
});
test('16 diez slots compartidos Business Job Rental; 17 rechazar undécima', () => {
  const m = lab();
  for (let k = 1; k <= 10; k++) buy(m, { listingId: k === 1 ? 'A' : `L${k}`, slot: k, idempotencyKey: `${k}`, event: { transactionId: `t${k}`, originalTransactionId: `c${k}`, notificationId: `n${k}` } });
  assert.equal(m.state.subscriptions.length, 10);
  assert.throws(() => prepare(m, { listingId: 'B', slot: undefined, idempotencyKey: '11' }), /NO_SAFE_SLOT/);
});
test('18 cadena nueva: A rechaza reutilizar; B experimental asocia B bajo supuesto explícito', () => {
  const permanent = expired('permanent').m; assert.throws(() => reuse(permanent), /NO_SAFE_SLOT/);
  const { m } = expired('episodes', true); const i = reuse(m); const r = m.ingest(rebuy(), { intentId: i.id });
  assert.equal(r.status, 'DELIVERED'); assert.match(r.assumption, /No concurrent external/);
  assert.deepEqual(m.state.episodes.map(a => [a.listingId, a.status]), [['A', 'closed'], ['B', 'active']]);
});
test('19 misma cadena para B: reconciliación, no mover A ni conceder B', () => {
  const { m } = expired(); const i = reuse(m);
  const r = m.ingest(rebuy({ originalTransactionId: 'chain-1' }), { intentId: i.id });
  assert.equal(r.status, 'RECONCILIATION_REQUIRED'); assert.equal(m.state.subscriptions.length, 1);
  assert.equal(m.state.episodes[0].listingId, 'A'); assert.equal(m.state.episodes[1].status, 'reconciliation');
  assert.equal(m.delivery('txn-B', BUYER.id), null);
});
test('20 reactivación externa cadena A tras B: cuarentena, no mover ni duplicar derechos', () => {
  const { m } = expired('episodes', true); const i = reuse(m); m.ingest(rebuy(), { intentId: i.id });
  const before = m.state.episodes.map(x => ({ ...x }));
  const r = m.ingest(rebuy({ originalTransactionId: 'chain-1', transactionId: 'old-external', notificationId: 'old-external', purchaseDate: 1010, signedDate: 1010 }));
  assert.equal(r.status, 'RECONCILIATION_REQUIRED'); assert.deepEqual(m.state.episodes, before);
  assert.equal(m.slotState(BUYER.id, 3), 'reconciliation'); assert.equal(m.delivery('old-external', BUYER.id), null);
});
for (const [name, patch, error] of [
  ['21 buyer equivocado', { appTransactionId: OTHER.appTransactionId, appAccountToken: OTHER.appAccountToken }, /WRONG_BUYER|IDENTITY/],
  ['22 environment equivocado', { environment: 'Production' }, /WRONG_ENVIRONMENT/],
  ['23 producto equivocado', { productId: product(3, 'featured') }, /WRONG_PRODUCT/],
]) test(name, () => {
  const m = lab(); const i = prepare(m); m.start(i.id); const before = m.snapshot();
  assert.throws(() => m.ingest(event(patch), { intentId: i.id }), error); assert.deepEqual(m.snapshot(), before);
});
test('24 doble toque mismo request retorna intención; cambios generan conflicto', () => {
  const m = lab(); const i = prepare(m); assert.equal(prepare(m).id, i.id);
  assert.equal(m.state.intents.length, 1);
  assert.throws(() => prepare(m, { listingId: 'B' }), /IDEMPOTENCY_CONFLICT/);
});
test('25 respuesta perdida después de commit recupera DELIVERED sin otro cobro', () => {
  const m = lab(); const i = prepare(m); m.start(i.id); const s = new SimulatedStoreKit(); const e = s.purchase(event());
  assert.throws(() => m.ingest(e, { intentId: i.id, loseResponse: true }), /RESPONSE_LOST/);
  assert.equal(m.state.deliveries.length, 1); assert.throws(() => s.finishTransaction(e.transactionId), /FINISH_BEFORE/);
  const r = m.ingest(e, { intentId: i.id }); s.confirmDelivery(e.transactionId, r, m, BUYER.id); s.finishTransaction(e.transactionId);
  assert.equal(s.store.charges, 1); assert.equal(m.state.transactions.length, 1);
});
test('26 notificación antes de verify correlaciona intención; verify idempotente', () => {
  const m = lab(); const i = prepare(m); m.start(i.id); const r = m.ingest(event());
  assert.equal(r.status, 'DELIVERED'); assert.deepEqual(m.ingest(event(), { intentId: i.id }), r);
  assert.equal(m.state.deliveries.length, 1);
});
test('27 backend timeout sin recibir petición: listener no finaliza y retry entrega', () => {
  const m = lab(); const i = prepare(m); m.start(i.id); const s = new SimulatedStoreKit(); const e = s.purchase(event());
  const seen = []; s.listenForTransactionUpdates(t => seen.push(t)); s.emitUpdates();
  assert.equal(seen.length, 1); assert.equal(s.store.finished.size, 0); assert.equal(m.state.deliveries.length, 0);
  const r = m.ingest(e); s.confirmDelivery(e.transactionId, r, m, BUYER.id); s.finishTransaction(e.transactionId);
  assert.equal(s.store.charges, 1);
});
test('28 pending sobrevive TTL, no se cancela por timeout y se entrega después', () => {
  const m = lab(); const i = prepare(m); m.start(i.id); m.pending(i.id); m.advance(150);
  assert.equal(m.canReuseSlot(BUYER.id, 3).reusable, false);
  assert.throws(() => m.terminate(i.id, 'failed'), /PURCHASE_MAY/); m.verifying(i.id);
  assert.equal(m.ingest(event({ purchaseDate: 150, expiresDate: 250, signedDate: 150 }), { intentId: i.id }).status, 'DELIVERED');
});
test('29 cancelación y fallo definitivos sin cobro liberan reserva sin historial financiero', () => {
  for (const status of ['canceled', 'failed']) {
    const m = lab(); const i = prepare(m); m.start(i.id); m.terminate(i.id, status, true);
    assert.equal(m.canReuseSlot(BUYER.id, 3).reusable, true);
  }
});
test('30 expiración de gracia pasa a retry sin liberación', () => {
  const m = lab(); const { e } = buy(m); m.advance(201); change(m, e, 'DID_FAIL_TO_RENEW', { signedDate: 201, graceExpiresDate: 220 });
  m.advance(221); change(m, e, 'GRACE_PERIOD_EXPIRED', { signedDate: 221 });
  assert.equal(sub(m).status, 'billing_retry'); assert.equal(m.canReuseSlot(BUYER.id, 3).reusable, false);
});
test('31 restaurar con buyer equivocado falla sin mutaciones', () => {
  const m = lab(); const { e } = buy(m); const before = m.snapshot();
  assert.throws(() => m.restore(OTHER.id, [e]), /WRONG_BUYER/); assert.deepEqual(m.snapshot(), before);
});
test('32 intentos concurrentes serializados no duplican reserva de slot o listing', async () => {
  const m = lab(); const results = await Promise.allSettled([
    Promise.resolve().then(() => prepare(m)),
    Promise.resolve().then(() => prepare(m, { listingId: 'B', idempotencyKey: 'b' })),
  ]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.throws(() => prepare(m, { slot: 4, idempotencyKey: 'same-listing' }), /LISTING_CONFLICT/);
});
test('33 listing ajeno o inexistente rechazado antes de iniciar compra', () => {
  const m = lab(); assert.throws(() => prepare(m, { buyerId: OTHER.id }), /LISTING_NOT_AUTHORIZED/);
  assert.throws(() => prepare(m, { listingId: 'missing' }), /LISTING_NOT_AUTHORIZED/);
});
test('34 refund antiguo no revoca B de nueva cadena', () => {
  const { m, last } = expired('episodes', true); const i = reuse(m); m.ingest(rebuy(), { intentId: i.id });
  change(m, last, 'REFUND', { signedDate: 1050 });
  assert.equal(m.state.subscriptions[1].status, 'active'); assert.equal(m.state.episodes[1].listingId, 'B');
});
test('35 misma cadena reactivada SIN reutilización conserva A', () => {
  const { m } = expired('permanent'); const r = m.ingest(rebuy({ originalTransactionId: 'chain-1' }));
  assert.equal(r.status, 'DELIVERED'); assert.equal(m.state.episodes[0].listingId, 'A');
});
test('36 CONTRAEJEMPLO: cadena nueva externa concurrente indistinguible para B experimental', () => {
  const { m } = expired('episodes', true); const i = reuse(m); const snapshot = m.snapshot();
  const fromApp = new SlotLab({ snapshot }); const fromExternal = new SlotLab({ snapshot });
  // Hidden causal origin differs; signed observable fields and stored intent do not.
  const proofFromApp = rebuy(); const proofFromExternal = structuredClone(proofFromApp);
  const a = fromApp.ingest(proofFromApp, { intentId: i.id }); const b = fromExternal.ingest(proofFromExternal);
  assert.equal(a.episodeId, b.episodeId); assert.equal(b.status, 'DELIVERED');
  assert.equal(fromExternal.state.episodes.find(x => x.id === b.episodeId).listingId, 'B');
  assert.match(b.assumption, /No concurrent external/);
  // Test PASS means the counterexample exists, NOT that reuse is safe.
});
test('37 cadena externa desconocida sin intención no se asigna por último anuncio', () => {
  const { m } = expired(); const r = m.ingest(rebuy());
  assert.equal(r.status, 'RECONCILIATION_REQUIRED'); assert.equal(m.state.episodes.length, 1);
});
test('38 assertion simulada ligada a cuerpo y nonce; no es App Attest real', () => {
  const a = new SimulatedAttest(); const key = a.attestInstallation(a.getChallenge());
  const assertion = a.createAssertion(key, a.getChallenge(), requestHash('request'));
  assert.throws(() => a.verify(assertion, 'tampered'), /ASSERTION_REJECTED/);
  assert.equal(a.verify(assertion, 'request'), true); assert.throws(() => a.verify(assertion, 'request'), /ASSERTION_REJECTED/);
});
test('39 fixtures no aceptan texto JWS ni unverified', () => {
  const m = lab(); assert.throws(() => m.ingest(event({ verification: 'unverified' })), /NOT_SYNTHETIC/);
  assert.throws(() => m.ingest({ jws: 'not-a-real-jws' }), /NOT_SYNTHETIC/);
});
test('40 ID de notificación/transacción repetido con datos diferentes rechazado', () => {
  const m = lab(); const { e } = buy(m);
  assert.throws(() => m.ingest({ ...e, expiresDate: 999 }), /NOTIFICATION_PAYLOAD_CONFLICT/);
  assert.throws(() => m.ingest({ ...e, notificationId: 'new', expiresDate: 999 }), /TRANSACTION_PAYLOAD_CONFLICT/);
});
test('41 publicación eliminada antes de entrega no se recrea ni se mueve', () => {
  const m = lab(); const i = prepare(m); m.start(i.id); m.state.listings = m.state.listings.filter(x => x.id !== 'A');
  const r = m.ingest(event(), { intentId: i.id }); assert.equal(r.reason, 'LISTING_UNAVAILABLE');
  assert.equal(m.state.deliveries.length, 0); assert.equal(m.state.episodes[0].listingId, 'A');
  assert.equal(m.state.transactions.length, 1); assert.equal(m.state.unresolved.length, 1);
});
test('42 B normal rechaza inferencia de nueva cadena a B: evidencia insuficiente', () => {
  const { m } = expired(); const i = reuse(m); const e = rebuy();
  const r = m.ingest(e, { intentId: i.id });
  assert.equal(r.reason, 'NEW_CHAIN_DOES_NOT_PROVE_NEW_LISTING_INTENT');
  assert.equal(m.delivery(e.transactionId, BUYER.id), null);
  assert.equal(m.state.episodes[0].listingId, 'A');
  assert.equal(m.state.transactions.find(t => t.key.endsWith('txn-B')).episodeId, null);
});
test('43 B normal devuelve reconciliación en ambos mundos indistinguibles', () => {
  const { m } = expired(); const i = reuse(m); const x = new SlotLab({ snapshot: m.snapshot() });
  const fromApp = m.ingest(rebuy(), { intentId: i.id }); const fromOutside = x.ingest(rebuy());
  assert.equal(fromApp.status, 'RECONCILIATION_REQUIRED'); assert.equal(fromOutside.status, 'RECONCILIATION_REQUIRED');
});
test('44 expiración por reloj sin evento/reconciliación no basta', () => {
  const m = lab(); buy(m); m.advance(10000);
  assert.equal(m.canReuseSlot(BUYER.id, 3).reusable, false);
  assert.throws(() => m.reconcileTerminal(BUYER.id, 3), /NOT_TERMINAL/);
});
test('45 fixture appAccountToken incorrecto y grupo incorrecto rechazados', () => {
  const m = lab(); const i = prepare(m); m.start(i.id);
  assert.throws(() => m.ingest(event({ appAccountToken: 'stolen-other' }), { intentId: i.id }), /WRONG_BUYER/);
  assert.throws(() => m.ingest(event({ subscriptionGroupIdentifier: 'TEST.group.4' }), { intentId: i.id }), /WRONG_PRODUCT/);
});
test('46 cannot finish con recibo inventado o de otro comprador', () => {
  const m = lab(); const { e, reply } = buy(m); const s = new SimulatedStoreKit(); s.purchase(e);
  assert.throws(() => s.confirmDelivery(e.transactionId, { status: 'DELIVERED', receipt: 'fake' }, m, BUYER.id), /NO_DURABLE/);
  assert.throws(() => s.confirmDelivery(e.transactionId, reply, m, OTHER.id), /NO_DURABLE/);
});
test('47 upgrade misma cadena conserva anuncio y no crea otro episodio', () => {
  const m = lab(); buy(m, { plan: 'featured' });
  m.ingest(event({ notificationId: 'upgrade', transactionId: 'upgrade', purchaseDate: 120, expiresDate: 220, signedDate: 120 }));
  assert.equal(sub(m).plan, 'premium'); assert.equal(m.state.episodes.length, 1);
  assert.equal(m.state.episodes[0].listingId, 'A');
});
test('48 restore rechaza cadena de otro comprador aun con identidad Y coherente', () => {
  const m = lab(); const { e } = buy(m);
  assert.throws(() => m.restore(OTHER.id, [{ ...e, appTransactionId: OTHER.appTransactionId, appAccountToken: OTHER.appAccountToken }]), /CHAIN_IDENTITY_CONFLICT/);
});
