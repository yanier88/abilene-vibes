import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moderateAndReload} from '../../src/auth/adminModeration.mjs';
import {createAdminWebSession} from '../../src/auth/adminWebSession.mjs';
const session={access_token:'synthetic-only',user:{id:'synthetic'}};
for(const kind of ['Claim','Event']) for(const status of ['approved','rejected']) {
 test(`${kind} ${status}: successful mutation reloads authoritative queue automatically`,async()=>{
  let db=['pending'],visible=[...db],reads=0;
  await moderateAndReload(async()=>{db=[];return {error:null};},async()=>{reads++;visible=[...db];});
  assert.deepEqual(visible,[]);assert.equal(reads,1);
 });
 test(`${kind} ${status}: failed mutation retains row and safe error`,async()=>{
  let visible=['pending'],reads=0;
  await assert.rejects(moderateAndReload(async()=>({error:{message:'private backend details'}}),async()=>{reads++;visible=[];}),{message:'Could not save moderation.'});
  assert.deepEqual(visible,['pending']);assert.equal(reads,0);
 });
}
test('post-mutation refresh waits for old read then fetches fresh authorized state',async()=>{
 let rows=['pending'],visible=[],release,reads=0,authorizations=0;
 const controller=createAdminWebSession({auth:{getUser:async()=>({data:{user:session.user}})},rpc:async()=>{authorizations++;return {data:true};}}, {
 onState:()=>{},load:async(_s,_r,current)=>{const snapshot=[...rows];reads++;if(reads===1)await new Promise(r=>release=r);if(current())visible=snapshot;},
 });
 const first=controller.apply(session);while(!release)await new Promise(r=>setImmediate(r));
 const mutation=moderateAndReload(async()=>{rows=[];return {};},()=>controller.refreshAfterMutation());
 await new Promise(r=>setImmediate(r));release();await Promise.all([first,mutation]);
 assert.equal(reads,2);assert.equal(authorizations,2);assert.deepEqual(visible,[]);
});
test('logout during pending post-mutation refresh cannot restore access',async()=>{
 let release,reads=0;const controller=createAdminWebSession({auth:{getUser:async()=>({data:{user:session.user}})},rpc:async()=>({data:true})},{onState:()=>{},load:async()=>{reads++;await new Promise(r=>release=r);}});
 const first=controller.apply(session);while(!release)await new Promise(r=>setImmediate(r));
 const refresh=controller.refreshAfterMutation();await controller.apply(null);release();await Promise.all([first,refresh]);assert.equal(reads,1);
});
test('both real handlers use post-mutation loader and retain safe errors and manual fallback',()=>{
 const s=readFileSync('src/App.jsx','utf8');
 for(const rpc of ['review_business_claim','moderate_premium_event']) {
 const at=s.indexOf(`() => supabase.rpc("${rpc}"`);assert.ok(at>0);assert.match(s.slice(at,at+500),/loadAdminData\(adminSession, false, true\)/);assert.match(s.slice(at,at+650),/catch \{ setAdminStatus\("error"\)/);
 }
 assert.match(s,/onClick=\{\(\) => loadAdminData\(adminSession, true\)\}/);
});
test('reload failure never fabricates success',async()=>{await assert.rejects(moderateAndReload(async()=>({}),async()=>{throw Error('reload unavailable');}),/reload unavailable/);});
