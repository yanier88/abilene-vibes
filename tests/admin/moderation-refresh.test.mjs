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
test('post-mutation refresh supersedes old read with fresh authorized state',async()=>{
 let rows=['pending'],visible=[],release,reads=0,authorizations=0;
 const controller=createAdminWebSession({auth:{getUser:async()=>({data:{user:session.user}})},rpc:async()=>{authorizations++;return {data:true};}}, {
 onState:()=>{},load:async(_s,_r,current)=>{const snapshot=[...rows];reads++;if(reads===1)await new Promise(r=>release=r);if(current())visible=snapshot;},
 });
 const first=controller.apply(session);while(!release)await new Promise(r=>setImmediate(r));
 const mutation=moderateAndReload(async()=>{rows=[];return {};},()=>controller.refreshAfterMutation());
 await new Promise(r=>setImmediate(r));release();await Promise.all([first,mutation]);
 assert.equal(reads,2);assert.equal(authorizations,2);assert.deepEqual(visible,[]);
});
test('logout invalidates every overlapping read',async()=>{
 const releases=[];let visible=[];const controller=createAdminWebSession({auth:{getUser:async()=>({data:{user:session.user}})},rpc:async()=>({data:true})},{onState:()=>{},load:async(_s,_r,current)=>{await new Promise(r=>releases.push(r));if(current())visible=['private'];}});
 const first=controller.apply(session);while(releases.length<1)await new Promise(r=>setImmediate(r));
 const refresh=controller.refreshAfterMutation();while(releases.length<2)await new Promise(r=>setImmediate(r));await controller.apply(null);releases.forEach(r=>r());await Promise.all([first,refresh]);assert.deepEqual(visible,[]);
});
test('both real handlers use post-mutation loader and retain safe errors and manual fallback',()=>{
 const s=readFileSync('src/App.jsx','utf8');
 for(const rpc of ['review_business_claim','moderate_premium_event']) {
 const at=s.indexOf(`() => supabase.rpc("${rpc}"`);assert.ok(at>0);assert.match(s.slice(at,at+500),/loadAdminData\(adminSession, false, true\)/);assert.match(s.slice(at,at+650),/catch \{ setAdminStatus\("error"\)/);
 }
 assert.match(s,/onClick=\{\(\) => loadAdminData\(adminSession, true\)\}/);
});
test('reload failure never fabricates success',async()=>{await assert.rejects(moderateAndReload(async()=>({}),async()=>{throw Error('reload unavailable');}),/reload unavailable/);});
test('post-mutation loader returns failure for failed reads or lost authorization',async()=>{
 let authorized=true,readOK=true;
 const controller=createAdminWebSession({auth:{getUser:async()=>({data:{user:session.user}})},rpc:async()=>({data:authorized})},{onState:()=>{},load:async()=>readOK});
 assert.equal(await controller.apply(session),true);
 readOK=false;assert.equal(await controller.refreshAfterMutation(),false);
 authorized=false;assert.equal(await controller.refreshAfterMutation(),false);
});

test('one click refresh supersedes a slow initial snapshot; counters and active module stay current',async()=>{
 let server=['old'],visible=[],count=0,release,reads=0;const loading=[];
 const controller=createAdminWebSession({auth:{getUser:async()=>({data:{user:session.user}})},rpc:async()=>({data:true})},{onState:()=>{},onLoading:v=>loading.push(v),load:async(_s,_r,current)=>{const rows=[...server];reads++;if(reads===1)await new Promise(r=>release=r);if(current()){visible=rows;count=rows.length;}return true;}});
 const initial=controller.apply(session);while(!release)await new Promise(r=>setImmediate(r));server=['fresh','new'];assert.equal(await controller.refresh(),true);assert.deepEqual(visible,server);assert.equal(count,2);release();await initial;assert.deepEqual(visible,server);assert.equal(count,2);assert.equal(loading.at(-1),false);
});
test('rapid clicks coalesce refresh without extra reads or stale results',async()=>{
 let release,reads=0;const c=createAdminWebSession({auth:{getUser:async()=>({data:{user:session.user}})},rpc:async()=>({data:true})},{onState:()=>{},load:async()=>{reads++;if(reads>1)await new Promise(r=>release=r);}});
 await c.apply(session);const a=c.refresh(),b=c.refresh(),d=c.refresh();while(!release)await new Promise(r=>setImmediate(r));release();await Promise.all([a,b,d]);assert.equal(reads,2);
});
test('all web module reads route through the same generation guard',()=>{const s=readFileSync('src/App.jsx','utf8');for(const name of ['Jobs','Rentals','Events','Businesses','Gallery'])assert.match(s,new RegExp('async function loadAdmin'+name+'[^\\n]+\\{\\n    if \\(adminWeb\\) return adminWebController.current\\?\\.refreshAfterMutation'));const start=s.indexOf('async function performAdminDataLoad');const end=s.indexOf('async function loadAdminJobs',start);const loader=s.slice(start,end);const guard=loader.indexOf('if (!isCurrent())');assert.ok(guard>0);assert.doesNotMatch(loader.slice(guard),/await /);assert.match(loader,/if \(!adminRentalResult.error\)/);assert.match(loader,/if \(!paymentRecordsResult.error\)/);});
test('failed reload retains previously authorized rows and ends loading',async()=>{
 let visible=['saved row'],fail=false;const states=[],busy=[];
 const c=createAdminWebSession({auth:{getUser:async()=>({data:{user:session.user}})},rpc:async()=>({data:true})},{onState:(s,value)=>states.push([s,value]),onLoading:x=>busy.push(x),load:async()=>{if(fail)throw Error('private network error');visible=['current row'];}});
 await c.apply(session);fail=true;assert.equal(await c.refresh(),false);assert.deepEqual(visible,['current row']);assert.equal(states.at(-1)[0],'DATA_ERROR');assert.equal(states.at(-1)[1],session);assert.equal(busy.at(-1),false);
});
