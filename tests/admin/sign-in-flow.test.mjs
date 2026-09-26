import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminWebSession} from '../../src/auth/adminWebSession.mjs';
const session={access_token:'synthetic-only',user:{id:'synthetic-admin'}};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(options={}){
 const states=[],calls=[];
 const client={auth:{getSession:async()=>({data:{session:null}}),signInWithPassword:async()=>{calls.push('signIn');return {data:{session}};},getUser:async()=>{calls.push('getUser');return {data:{user:session.user}};},signOut:async()=>({})},rpc:async()=>{calls.push('is_service_admin');return {data:true};}};
 const c=createAdminWebSession(client,{onState:(s,value)=>states.push([s,value]),load:async()=>{calls.push('load');return true;},...options});
 return {c,client,states,calls};
}
test('Sign In submits on first tap: pending restore cannot gate explicit login',async()=>{
 const x=fixture(),old=deferred();x.client.auth.getSession=()=>old.promise;
 const restoration=x.c.restore();assert.equal(await x.c.login({}),true);
 old.resolve({data:{session:null}});await restoration;
 assert.deepEqual(x.calls,['signIn','getUser','is_service_admin','load']);
 assert.equal(x.states.at(-1)[0],'AUTHORIZED_ADMIN');
});
test('duplicate submits and SDK restoration during login make exactly one signIn and load',async()=>{
 const x=fixture(),reply=deferred();x.client.auth.signInWithPassword=()=>{x.calls.push('signIn');return reply.promise;};
 const a=x.c.login({}),b=x.c.login({}),event=x.c.restore();
 reply.resolve({data:{session}});await Promise.all([a,b,event]);
 assert.deepEqual(x.calls,['signIn','getUser','is_service_admin','load']);
});
test('invalid credentials recover for a later successful submission',async()=>{
 const x=fixture(),ok=x.client.auth.signInWithPassword;
 x.client.auth.signInWithPassword=async()=>({error:{message:'private detail'}});
 assert.equal(await x.c.login({}),false);assert.equal(x.states.at(-1)[0],'LOGIN_ERROR');
 x.client.auth.signInWithPassword=ok;assert.equal(await x.c.login({}),true);
});
test('non-admin submission never exposes a protected session or loads data',async()=>{
 const x=fixture();x.client.rpc=async()=>({data:false});assert.equal(await x.c.login({}),false);
 assert.equal(x.states.at(-1)[0],'ACCESS_DENIED');assert.ok(x.states.every(([,s])=>!s));assert.ok(!x.calls.includes('load'));
});
test('hanging restoration times out safely without locking the next sign-in',async()=>{
 const x=fixture({authTimeoutMs:10});x.client.auth.getSession=()=>new Promise(()=>{});
 assert.equal(await x.c.restore(),false);assert.equal(x.states.at(-1)[0],'NETWORK_ERROR');assert.equal(await x.c.login({}),true);
});
test('hanging sign-in times out, recovers, and its late reply cannot expose protected data',async()=>{
 const x=fixture({authTimeoutMs:10}),reply=deferred(),ok=x.client.auth.signInWithPassword;
 x.client.auth.signInWithPassword=()=>reply.promise;assert.equal(await x.c.login({}),false);assert.equal(x.states.at(-1)[0],'NETWORK_ERROR');
 reply.resolve({data:{session}});await Promise.resolve();assert.ok(!x.calls.includes('load'));
 x.client.auth.signInWithPassword=ok;assert.equal(await x.c.login({}),true);
});
test('hanging authorization fails closed and releases submission',async()=>{
 const x=fixture({authTimeoutMs:10});x.client.auth.getUser=()=>new Promise(()=>{});assert.equal(await x.c.login({}),false);
 assert.equal(x.states.at(-1)[0],'NETWORK_ERROR');assert.ok(x.states.every(([,s])=>!s));assert.ok(!x.calls.includes('load'));
});
