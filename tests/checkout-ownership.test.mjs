import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCheckoutOwner, verifiedOwnership } from '../supabase/functions/create-checkout-session/ownership.ts';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const config = {supabaseUrl:'https://example.supabase.co', anonKey:'public-test-key', publishableKey:'public-test-publishable'};
const request = token => new Request('https://example.invalid', {headers:token ? {authorization:token} : {}});
const neverFetch = () => { throw Error('Unexpected remote call'); };
test('legacy no bearer and exact configured public keys remain anonymous', async () => {
  for (const token of [undefined,'Bearer public-test-key','Bearer public-test-publishable']) {
    assert.equal(await resolveCheckoutOwner(request(token),config,neverFetch),null);
  }
});
test('real bearer is verified against Auth and body owner cannot override it', async () => {
  const id=await resolveCheckoutOwner(request('Bearer user-token'), config, async (url, options) => {
    assert.equal(url,'https://example.supabase.co/auth/v1/user');
    assert.equal(options.headers.Authorization,'Bearer user-token');
    return Response.json({id:A,is_anonymous:false});
  });
  for (const title of ['Job fixture','Rental fixture']) {
    assert.deepEqual(verifiedOwnership({title,owner_user_id:B,advertiser_user_id:B},id),{title,owner_user_id:A,advertiser_user_id:A});
  }
});
test('forged JWT, expired JWT, malformed bearer and public-looking prefix fail closed', async () => {
  for (const token of ['Bearer forged.jwt.token','Bearer expired','Bearer sb_publishable_untrusted','Basic abc']) {
    await assert.rejects(resolveCheckoutOwner(request(token),config,async () => new Response('',{status:401})),error=>error.status===401);
  }
});
test('Auth unavailable does not downgrade a request to legacy', async () => {
  await assert.rejects(resolveCheckoutOwner(request('Bearer user-token'),config,async()=>{throw Error('offline');}),error=>error.status===503);
});
test('malformed Auth response and anonymous Auth account are not recoverable identity', async () => {
  for(const user of [{id:'not-a-uuid'},{id:A,is_anonymous:true}]) {
    await assert.rejects(resolveCheckoutOwner(request('Bearer user-token'),config,async()=>Response.json(user)),error=>error.status===401);
  }
});
test('legacy marker injection is stripped, legacy owner and original payload preserved', () => {
  const payload={title:'legacy',owner_user_id:'visitor-key',advertiser_user_id:B};
  assert.deepEqual(verifiedOwnership(payload,null),{title:'legacy',owner_user_id:'visitor-key'});
  assert.equal(payload.advertiser_user_id,B);
  assert.equal(verifiedOwnership(null,A),null);
});
test('production legacy fingerprint does not trust an anonymous-looking forged JWT', async () => {
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from('{"role":"anon","ref":"ymgiwjuhgvfexitynmtb"}').toString('base64url')}.forged`;
  let calls = 0;
  await assert.rejects(resolveCheckoutOwner(request(`Bearer ${token}`), {
    ...config, supabaseUrl: 'https://ymgiwjuhgvfexitynmtb.supabase.co',
  }, async () => { calls++; return new Response('', {status:401}); }), error => error.status === 401);
  assert.equal(calls, 1);
});
