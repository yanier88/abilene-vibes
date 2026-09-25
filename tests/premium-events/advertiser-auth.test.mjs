import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advertiserAccountAction,verifiedAdvertiser} from '../../src/auth/advertiserSession.mjs';
function client() {
 const calls=[]; const c={calls,auth:{
  getUser:async()=>{calls.push('getUser');return {data:{user:{id:'A'}}};},
  signUp:async credentials=>{calls.push(['signUp',credentials]);return {data:{session:null}};},
  signInWithPassword:async credentials=>{calls.push(['signIn',credentials]);return {data:{session:{user:{id:'A'}}}};},
  signOut:async()=>{calls.push('out');return {};},
 },rpc:async name=>{calls.push(name);return {};}};
 return c;
}
test('create advertiser uses Supabase signup; no profile until authenticated confirmation',async()=>{
 const c=client();assert.match(await advertiserAccountAction(c,'create',' a@example.invalid ','fake-test-password'),/confirm/);
 assert.deepEqual(c.calls,[['signUp',{email:'a@example.invalid',password:'fake-test-password'}]]);
});
test('sign in validates identity and ensures server-owned profile',async()=>{
 const c=client();await advertiserAccountAction(c,'in','a@example.invalid','fake-test-password');
 assert.deepEqual(c.calls.slice(1),['getUser','ensure_advertiser_profile']);
});
test('restored user validated remotely before profile RPC',async()=>{
 const c=client();assert.equal((await verifiedAdvertiser(c)).id,'A');assert.deepEqual(c.calls,['getUser','ensure_advertiser_profile']);
});
test('sign out uses Supabase, no manual token handling',async()=>{
 const c=client();await advertiserAccountAction(c,'out');assert.deepEqual(c.calls,['out']);
});
test('invalid session cannot create profile or submit',async()=>{
 const c=client();c.auth.getUser=async()=>({data:{user:null},error:{message:'expired'}});
 await assert.rejects(()=>verifiedAdvertiser(c),/SIGN_IN_REQUIRED/);assert.deepEqual(c.calls,[]);
});
test('profile failure fails closed',async()=>{
 const c=client();c.rpc=async()=>({error:{message:'unavailable'}});await assert.rejects(()=>verifiedAdvertiser(c),/PROFILE_UNAVAILABLE/);
});
test('password error does not query profile',async()=>{
 const c=client();c.auth.signInWithPassword=async()=>({error:{message:'wrong password'}});
 await assert.rejects(()=>advertiserAccountAction(c,'in','a','b'),/AUTH_FAILED/);assert.deepEqual(c.calls,[]);
});
test('failed sign out is not reported as successful',async()=>{
 const c=client();c.auth.signOut=async()=>({error:{message:'offline'}});await assert.rejects(()=>advertiserAccountAction(c,'out'),/SIGN_OUT_FAILED/);
});
test('business form retained before awaiting auth; identity gate precedes INSERT',()=>{
 const app=readFileSync('src/App.jsx','utf8');const flow=app.slice(app.indexOf('const handleBusinessSubmit'),app.indexOf('const handleGallerySubmit'));
 assert.ok(flow.indexOf('const form = event.currentTarget')<flow.indexOf('await verifiedAdvertiser'));
 assert.ok(flow.indexOf('await verifiedAdvertiser')<flow.indexOf('.insert('));
 assert.match(flow,/setAdvertiserAuthRequired\(true\); return/);
});
test('Admin claims use common initial/Refresh loader and RPCs; no direct event writes remain',()=>{
 const app=readFileSync('src/App.jsx','utf8');
 assert.match(app,/setPendingClaims\(pendingClaimsResult.data/);assert.match(app,/review_business_claim/);assert.match(app,/await loadAdminData\(\)/);
 assert.doesNotMatch(app,/\.from\("event_submissions"\)\s*\.(insert|update|delete)/);
});
