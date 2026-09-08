import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOCAL_PRODUCTS, localEntryEnabled, verifiedLocalGate, mergeKnown, safeEvent, localConfirmation, markExplicitFinish } from '../../src/native/appleIAPLocalModel.mjs';
const event = (id = '90071992547409930') => ({ status: 'verified', proof: { verification: 'verified', bundleId: 'com.abilenevibes.app', transactionId: id, originalTransactionId: id, productId: LOCAL_PRODUCTS[0], environment: 'Xcode', jwsRepresentation: 'DO-NOT-EXPOSE', appAccountToken: 'TEST-UUID' }, localDeliveryConfirmation: { transactionId: id, receipt: 'XCODE-TEST.opaque' } });
test('laboratory entry requires explicit flag and native iOS, never Android/web', () => {
  assert.equal(localEntryEnabled('true', true, 'ios'), true);
  for (const args of [['true',true,'android'],['true',false,'ios'],[undefined,true,'ios'],['false',true,'ios']]) assert.equal(localEntryEnabled(...args), false);
});
test('environment gate rejects Sandbox, Production and unverified/native-disabled responses', () => {
  const r = { status: 'verified', localTestEnabled: true, proof: { verification: 'verified', environment: 'Xcode', bundleId: 'com.abilenevibes.app' } };
  assert.equal(verifiedLocalGate(r),true);
  for (const environment of ['Sandbox','Production',undefined]) assert.equal(verifiedLocalGate({...r,proof:{...r.proof,environment}}),false);
  assert.equal(verifiedLocalGate({...r,localTestEnabled:false}),false);
  assert.equal(verifiedLocalGate({...r,status:'unverified'}),false);
});
test('empty unfinished retains pending evidence; only explicit success marks finished', () => {
  const e=event();let state=mergeKnown({},[e],'purchase');
  assert.match(state[e.proof.transactionId].delivery,/pending/);
  assert.equal(mergeKnown(state,[],'unfinished')[e.proof.transactionId].knownPendingFinish,true);
  assert.equal(mergeKnown(state,[],'unfinished')[e.proof.transactionId].reconciliationRequired,true);
  state=markExplicitFinish(state,{finished:true,transactionId:e.proof.transactionId});
  assert.match(mergeKnown(state,[e],'sync')[e.proof.transactionId].delivery,/explicitly finished/);
  assert.throws(()=>markExplicitFinish(state,{finished:false,transactionId:e.proof.transactionId}));
});
test('reconciliation merges independent groups and events without inferring finish', () => {
  let state=mergeKnown({},[event('1')],'purchase');state=mergeKnown(state,[event('2')],'transactionUpdate');state=mergeKnown(state,[event('1')],'entitlements');
  assert.equal(Object.keys(state).length,2);assert.deepEqual(state['1'].sources,['purchase','entitlements']);assert.match(state['2'].delivery,/pending/);
});
test('diagnostic projection excludes JWS, account token and opaque delivery receipt', () => {
  const display=JSON.stringify(safeEvent(event()));assert.ok(!/DO-NOT-EXPOSE|TEST-UUID|opaque|jwsRepresentation/.test(display));
  assert.equal(safeEvent(event()).transactionId,'90071992547409930');
});
test('local confirmation rejects mismatched ID, environment and unverified evidence', () => {
  const e=event();assert.equal(localConfirmation(e),e.localDeliveryConfirmation);
  assert.equal(localConfirmation({...e,localDeliveryConfirmation:{transactionId:'wrong',receipt:'XCODE-TEST.opaque'}}),null);
  assert.equal(localConfirmation({...e,proof:{...e.proof,environment:'Production'}}),null);
  assert.equal(localConfirmation({status:'unverified'}),null);
});
test('native synthetic delivery is compiled only for Debug simulator and authenticates HMAC', () => {
  const swift=readFileSync(new URL('../../ios/App/App/AbileneStoreKitService.swift',import.meta.url),'utf8');
  assert.match(swift,/#if DEBUG && targetEnvironment\(simulator\)/);
  assert.match(readFileSync(new URL('../../ios/App/App/LocalStoreKitSecurity.swift',import.meta.url),'utf8'),/HMAC<SHA256>\.isValidAuthenticationCode/);
  assert.match(swift,/guard await LocalStoreKitTest\.verifiedXcode\(\)/);
  assert.match(swift,/UnconfiguredDeliveryVerifier[\s\S]*?async -> Bool \{ false \}/);
  assert.equal((swift.match(/await transaction\.finish\(\)/g)||[]).length,1);
});
