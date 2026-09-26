import test from 'node:test';
import assert from 'node:assert/strict';
import { businessPostingStep, loadPostingContext } from '../../src/components/premiumEventFlow.mjs';
import { readFileSync } from 'node:fs';
const option = (extra = {}) => ({ business_id: 'owned', provider: 'stripe', occupied: 1, can_submit: true, ...extra });
for (const [name, rows, id, expected] of [
  ['no linked business', [], '', 'none'],
  ['one eligible business', [option()], 'owned', 'form'],
  ['multiple businesses need selection', [option(), option({business_id:'second'})], '', 'choose'],
  ['foreign ID cannot select a business', [option()], 'foreign', 'choose'],
  ['Free', [option({provider:null,can_submit:false})], 'owned', 'premium'],
  ['Featured', [option({provider:null,can_submit:false})], 'owned', 'premium'],
  ['Apple Premium available', [option({provider:'apple'})], 'owned', 'form'],
  ['Premium full', [option({occupied:3,can_submit:false})], 'owned', 'full'],
  ['server denial wins', [option({can_submit:false})], 'owned', 'unavailable'],
]) test(name, () => assert.equal(businessPostingStep(rows,id), expected));
test('invalid session reveals neither business options nor submissions',async()=>{
 let calls=0;const c={auth:{getUser:async()=>({data:{user:null}})},rpc:()=>calls++,from:()=>calls++};
 assert.deepEqual(await loadPostingContext(c),{authenticated:false,options:[],own:[]});assert.equal(calls,0);
});
test('validated user uses owner-scoped RPC and own submissions only',async()=>{
 const calls=[];const chain={select(){return this;},eq(k,v){calls.push([k,v]);return this;},order:async()=>({data:[]})};
 const c={auth:{getUser:async()=>({data:{user:{id:'current-user'}}})},rpc:async name=>{calls.push(name);return {data:[option()]};},from:name=>{calls.push(name);return chain;}};
 assert.equal((await loadPostingContext(c)).authenticated,true);assert.deepEqual(calls,['premium_event_options','event_submissions',['submitted_by','current-user']]);
});
test('eligibility network failure does not become a Premium state',async()=>{
 const c={auth:{getUser:async()=>({data:{user:{id:'u'}}})},rpc:async()=>({error:{}}),from:()=>({select(){return this;},eq(){return this;},order:async()=>({data:[]})})};
 await assert.rejects(()=>loadPostingContext(c),/UNAVAILABLE/);
});
test('public Events retains header and listing without permanent account form',()=>{
 const s=readFileSync('src/App.jsx','utf8');const events=s.slice(s.indexOf('if (page === "events")'),s.indexOf('if (page === "events")')+3000);
 assert.match(events,/Events in Abilene/);assert.match(events,/Featured Abilene events/);assert.doesNotMatch(events,/<AdvertiserAccount/);
});
