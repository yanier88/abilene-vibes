import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { LOCAL_PRODUCTS, mergeKnown, markExplicitFinish, verifiedLocalGate } from '../../src/native/appleIAPLocalModel.mjs';
const e = id => ({status:'verified',proof:{verification:'verified',bundleId:'com.abilenevibes.app',environment:'Xcode',transactionId:id,originalTransactionId:id,productId:LOCAL_PRODUCTS[0],expiresDate:Date.now()+100000}});
test('entitlement-only recovery requires reconciliation, not assumed pending finish',()=>{
 const s=mergeKnown({},[e('1')],'entitlements')['1'];assert.equal(s.entitlementActive,true);assert.equal(s.knownPendingFinish,false);assert.equal(s.reconciliationRequired,true);assert.equal(s.explicitlyFinished,false);
});
test('unfinished omission retains pending and asks for reconciliation; sync recovers it',()=>{
 let s=mergeKnown({},[e('1')],'purchase');s=mergeKnown(s,[],'unfinished');assert.equal(s['1'].knownPendingFinish,true);assert.equal(s['1'].reconciliationRequired,true);
 s=mergeKnown(s,[e('1')],'sync unfinished');assert.equal(s['1'].recoveredAfterSync,true);assert.equal(s['1'].reconciliationRequired,false);assert.equal(s['1'].explicitlyFinished,false);
});
test('finished and active entitlement are independent; empty entitlements never finishes',()=>{
 let s=mergeKnown({},[e('1')],'purchase');s=mergeKnown(s,[e('1')],'entitlements');s=markExplicitFinish(s,{finished:true,transactionId:'1'});assert.equal(s['1'].entitlementActive,true);assert.equal(s['1'].knownPendingFinish,false);
 const p=mergeKnown(mergeKnown({},[e('2')],'purchase'),[],'entitlements');assert.equal(p['2'].explicitlyFinished,false);assert.equal(p['2'].knownPendingFinish,true);
});
test('session restart has empty memory, sync evidence reconstructs without inventing finish',()=>{
 const s=mergeKnown({},[e('9')],'sync unfinished');assert.equal(s['9'].knownPendingFinish,true);assert.equal(s['9'].recoveredAfterSync,true);assert.equal(s['9'].explicitlyFinished,false);
});
test('wrong bundle, product, verification or environment cannot enter reconciler',()=>{
 for(const overrides of [{bundleId:'wrong'},{productId:'wrong'},{verification:'unverified'},{environment:'Sandbox'}]) assert.deepEqual(mergeKnown({},[{...e('1'),proof:{...e('1').proof,...overrides}}],'purchase'),{});
 const proof={status:'verified',localTestEnabled:true,proof:{verification:'verified',bundleId:'wrong',environment:'Xcode'}};assert.equal(verifiedLocalGate(proof),false);
});
test('all Swift bridge finish calls are confined to finishTransaction',()=>{
 const dir=new URL('../../ios/App/App/',import.meta.url);let total=0;
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.swift'))){
  const s=readFileSync(new URL(file,dir),'utf8');const hits=[...s.matchAll(/\b(?:\w+\.)?finish\s*\(/g)];total+=hits.length;
  for(const hit of hits){assert.equal(file,'AbileneStoreKitService.swift');const start=s.indexOf('func finishTransaction('),end=s.indexOf('private func record(',start);assert.ok(hit.index>start&&hit.index<end);}
 }assert.equal(total,1);
});
test('native purchase and sync fail closed unconditionally; web build marker required',()=>{
 const s=readFileSync(new URL('../../ios/App/App/AbileneStoreKitService.swift',import.meta.url),'utf8');
 for(const method of ['func purchase(','func syncPurchases(']){const body=s.slice(s.indexOf(method));assert.match(body.slice(0,250),/guard await LocalStoreKitTest.verifiedXcode\(\)/);}
 assert.match(s,/guard enabled, webBuildEnabled/);
});
test('blocked laboratory renders no purchase controls',()=>{
 const s=readFileSync(new URL('../../src/native/AppleIAPLocalTest.jsx',import.meta.url),'utf8');assert.match(s,/\{ready && !closed && <fieldset/);
});
test('StoreKit reporting unfinished after explicit finish remains a visible conflict',()=>{
 let s=mergeKnown({},[e('5')],'purchase');s=markExplicitFinish(s,{finished:true,transactionId:'5'});s=mergeKnown(s,[e('5')],'sync unfinished');assert.equal(s['5'].explicitlyFinished,true);assert.equal(s['5'].reconciliationRequired,true);assert.equal(s['5'].recoveredAfterSync,true);
});
