// TEST/SYNTHETIC implementations. Never an authentication or StoreKit adapter.
import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
export class SimulatedAttest {
  constructor() { this.next = 0; this.challenges = new Map(); this.installations = new Set(); }
  getChallenge() { const nonce = `TEST-nonce-${++this.next}`; this.challenges.set(nonce, true); return nonce; }
  attestInstallation(nonce) {
    if (!this.challenges.delete(nonce)) throw new Error('CHALLENGE_REPLAY');
    const key = `TEST-key-${++this.next}`; this.installations.add(key); return key;
  }
  createAssertion(key, nonce, requestHash) {
    if (!this.installations.has(key)) throw new Error('UNKNOWN_INSTALLATION');
    return { fixtureKind: 'TEST/SYNTHETIC', key, nonce, requestHash };
  }
  verify(assertion, body) {
    if (assertion.fixtureKind !== 'TEST/SYNTHETIC' || !this.installations.has(assertion.key) ||
        assertion.requestHash !== hash(body) || !this.challenges.delete(assertion.nonce)) throw new Error('ASSERTION_REJECTED');
    return true;
  }
}
export const requestHash = hash;
export const storeState = () => ({ queue: new Map(), charges: 0, finished: new Set() });
export class SimulatedStoreKit {
  constructor(persistentStore = storeState()) { this.store = persistentStore; this.listeners = []; this.receipts = new Map(); }
  purchase(e) {
    if (!this.store.queue.has(e.transactionId)) {
      this.store.charges++;
      this.store.queue.set(e.transactionId, structuredClone(e));
    }
    return structuredClone(e);
  }
  listenForTransactionUpdates(listener) { this.listeners.push(listener); }
  emitUpdates() {
    for (const e of this.store.queue.values()) if (!this.store.finished.has(e.transactionId)) {
      for (const listener of this.listeners) listener(structuredClone(e));
    }
  }
  confirmDelivery(transactionId, response, backend, buyerId) {
    const durable = backend.delivery(transactionId, buyerId);
    if (response?.status !== 'DELIVERED' || !durable || response.receipt !== durable.receipt) throw new Error('NO_DURABLE_DELIVERY');
    this.receipts.set(transactionId, response.receipt);
  }
  finishTransaction(transactionId) {
    if (!this.store.queue.has(transactionId) || !this.receipts.has(transactionId)) throw new Error('FINISH_BEFORE_DELIVERED');
    this.store.finished.add(transactionId);
  }
}
