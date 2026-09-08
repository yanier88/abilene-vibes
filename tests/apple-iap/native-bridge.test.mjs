import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapNativeTransaction } from './native-bridge-adapter.mjs';

test('pending and cancellation remain different and neither grants proof', () => {
  assert.deepEqual(mapNativeTransaction({ status: 'pending' }), { status: 'pending' });
  assert.deepEqual(mapNativeTransaction({ status: 'userCancelled' }), { status: 'userCanceled' });
  assert.equal(mapNativeTransaction({ status: 'unverified' }).proof, undefined);
});
test('adapter refuses missing environment instead of inventing Production', () => {
  assert.throws(() => mapNativeTransaction({ status: 'verified', proof: { verification: 'verified' } }));
});
test('adapter preserves signed evidence without pretending to validate its signature', () => {
  const proof = { verification: 'verified', jwsRepresentation: 'TEST-ONLY-NOT-REAL-JWS',
    environment: 'Xcode', transactionId: '9007199254740993', originalTransactionId: '1',
    productId: 'example', bundleId: 'test.host' };
  assert.deepEqual(mapNativeTransaction({ status: 'verified', proof }), { status: 'verified', proof });
});
test('local catalog has ten independent monthly groups and premium above featured', () => {
  const config = JSON.parse(readFileSync(new URL('../../ios/App/StoreKitDevelopment/AbileneLocal.storekit', import.meta.url)));
  assert.equal(config.subscriptionGroups.length, 10);
  const ids = new Set();
  config.subscriptionGroups.forEach((group, index) => {
    assert.equal(group.name, `promotion_slot_${String(index + 1).padStart(2, '0')}`);
    assert.equal(group.subscriptions.length, 2);
    for (const product of group.subscriptions) {
      const premium = product.productID.includes('.premium.');
      assert.equal(product.subscriptionGroupID, group.id);
      assert.equal(product.recurringSubscriptionPeriod, 'P1M');
      assert.equal(product.displayPrice, premium ? '67.99' : '24.99');
      assert.equal(product.groupNumber, premium ? 1 : 2);
      ids.add(product.productID);
    }
  });
  assert.equal(ids.size, 20);
});
