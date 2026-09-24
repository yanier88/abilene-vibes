import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminWebSession } from '../../src/auth/adminWebSession.mjs';
const session = { access_token: 'test-only-token', user: { id: 'test-user' } };
function setup({ current = session, admin = true, invalid = false, wrong = false, network = false, load } = {}) {
  const states = [], loads = [];
  const client = {
    auth: {
      getSession: async () => ({ data: { session: current } }),
      getUser: async () => ({ data: { user: invalid ? null : session.user }, error: invalid ? {} : null }),
      signInWithPassword: async () => ({ data: { session }, error: wrong ? {} : null }),
      signOut: async () => {},
    },
    rpc: async () => { if (network) throw Error('network'); return { data: admin }; },
  };
  const controller = createAdminWebSession(client, { onState: (state, value) => states.push([state, value]), load: async (...args) => { loads.push(args); await load?.(...args); } });
  return { controller, client, states, loads, last: () => states.at(-1)?.[0] };
}
test('no session: login, no protected load', async () => { const x=setup({current:null}); await x.controller.restore(); assert.equal(x.last(),'NOT_AUTHENTICATED'); assert.equal(x.loads.length,0); });
test('wrong password rejected', async () => { const x=setup({wrong:true}); await x.controller.login({}); assert.equal(x.last(),'LOGIN_ERROR'); assert.equal(x.loads.length,0); });
test('authenticated non-admin denied', async () => { const x=setup({admin:false}); await x.controller.restore(); assert.equal(x.last(),'ACCESS_DENIED'); assert.equal(x.loads.length,0); });
test('authorized admin login loads automatically', async () => { const x=setup(); await x.controller.login({}); assert.equal(x.last(),'AUTHORIZED_ADMIN'); assert.equal(x.loads.length,1); });
test('reload restores valid authorized session and loads', async () => { const x=setup(); await x.controller.restore(); assert.equal(x.loads.length,1); assert.equal(x.last(),'AUTHORIZED_ADMIN'); });
test('Refresh uses same loader and revalidates authorization', async () => { const x=setup(); await x.controller.restore(); await x.controller.refresh(); assert.equal(x.loads.length,2); x.client.rpc=async()=>({data:false}); await x.controller.refresh(); assert.equal(x.last(),'ACCESS_DENIED'); assert.equal(x.loads.length,2); });
test('invalid/expired session rejected', async () => { const x=setup({invalid:true}); await x.controller.restore(); assert.equal(x.last(),'NOT_AUTHENTICATED'); assert.equal(x.loads.length,0); });
test('authorization network failure safe and retry works', async () => { const x=setup({network:true}); await x.controller.restore(); assert.equal(x.last(),'NETWORK_ERROR'); assert.equal(x.loads.length,0); x.client.rpc=async()=>({data:true}); await x.controller.restore(); assert.equal(x.loads.length,1); });
test('data network rejection safe and retry works', async () => { let fail=true; const x=setup({load:async()=>{if(fail)throw Error('network');}}); await x.controller.restore(); assert.equal(x.last(),'NETWORK_ERROR'); fail=false; await x.controller.restore(); assert.equal(x.last(),'AUTHORIZED_ADMIN'); });
test('duplicate auth events and concurrent refresh coalesce', async () => { const x=setup(); await Promise.all([x.controller.apply(session),x.controller.apply(session)]); assert.equal(x.loads.length,1); await x.controller.apply(session); assert.equal(x.loads.length,1); await Promise.all([x.controller.refresh(),x.controller.apply(session)]); assert.equal(x.loads.length,2); });
test('sign-out invalidates in-flight data completion', async () => { let release, guard; const x=setup({load:async(_s,_r,current)=>{guard=current; await new Promise(r=>release=r);}}); const work=x.controller.restore(); while(!release) await new Promise(r=>setImmediate(r)); await x.controller.apply(null); assert.equal(guard(),false); release(); await work; assert.equal(x.last(),'NOT_AUTHENTICATED'); });
test('disposed authorization cannot load or expose admin', async () => { const x=setup(); const work=x.controller.apply(session); x.controller.dispose(); await work; assert.equal(x.loads.length,0); });
test('late login response cannot undo a sign-out', async () => { const x=setup(); let release; x.client.auth.signInWithPassword=()=>new Promise(r=>release=r); const work=x.controller.login({}); await x.controller.apply(null); release({data:{session}}); await work; assert.equal(x.last(),'NOT_AUTHENTICATED'); assert.equal(x.loads.length,0); });
