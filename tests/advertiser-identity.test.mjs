import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyListing, canManageListing } from '../src/auth/ownership.js';
import { verifiedAdminSession } from '../src/auth/session.js';

test('authenticated marker, not client owner ID, determines ownership', () => {
  const row = { advertiser_user_id: 'alice', owner_user_id: 'bob' };
  assert.equal(canManageListing(row, 'bob', 'bob'), false);
  assert.equal(canManageListing(row, 'alice', 'device'), true);
});
test('anonymous visitor cannot claim an authenticated listing', () => {
  assert.equal(canManageListing({advertiser_user_id:'alice', owner_user_id:'device'}, '', 'device'), false);
});
test('legacy device access survives login but is not a claim', () => {
  const row = { owner_user_id: 'device' };
  assert.equal(classifyListing(row, '', 'device'), 'legacy');
  assert.equal(classifyListing(row, 'alice', 'device'), 'legacy');
  assert.equal(classifyListing(row, 'alice', 'new-device'), 'other');
});
test('UUID matching user without server marker is not authenticated ownership', () => {
  assert.equal(classifyListing({owner_user_id:'alice'}, 'alice', 'device'), 'other');
  assert.equal(canManageListing({}, 'alice', 'device'), false);
});
test('normal session never grants Admin', async () => {
  const session = {user:{id:'alice'}};
  assert.equal(await verifiedAdminSession({rpc:async () => ({data:false})},session),null);
});
test('failed or unexpected permission response fails closed', async () => {
  for (const response of [{data:true,error:{}},{data:'true'},{data:null}]) {
    assert.equal(await verifiedAdminSession({rpc:async () => response},{user:{id:'alice'}}),null);
  }
});
test('verified Admin retains same session', async () => {
  const session = {user:{id:'admin'}};
  assert.equal(await verifiedAdminSession({rpc:async name => {
    assert.equal(name,'is_service_admin'); return {data:true};
  }},session),session);
});
test('logout does not query Admin privileges', async () => {
  assert.equal(await verifiedAdminSession({rpc:() => {throw Error('unexpected');}},null),null);
});

import { readWithIdentity } from '../src/auth/readListings.js';
test('schema rollout keeps legacy reads and owner field before migration', async () => {
  const calls = [];
  const result = await readWithIdentity(async fields => {
    calls.push(fields);
    return fields.includes('advertiser_user_id') ? {error:{code:'42703'}} : {data:[{id:1,owner_user_id:'device'}]};
  }, 'id,owner_user_id');
  assert.equal(result.data[0].owner_user_id,'device');
  assert.deepEqual(calls,['id,owner_user_id,advertiser_user_id','id,owner_user_id']);
});
test('authorization errors never trigger an anonymous or weakened retry', async () => {
  let calls = 0;
  const result = await readWithIdentity(async () => { calls++; return {error:{code:'42501'}}; },'id');
  assert.equal(calls,1); assert.equal(result.error.code,'42501');
});
