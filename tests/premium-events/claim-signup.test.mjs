import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advertiserAccountAction, accountActionRequired, safeAuthMessage} from '../../src/auth/advertiserSession.mjs';
import {canRequestClaim} from '../../src/components/premiumEventFlow.mjs';
const run = result => advertiserAccountAction({auth:{signUp:async()=>result}},'create','test@example.invalid','test-password');
for (const [name,user] of [['new-looking',{id:'new',identities:[{provider:'email'}],confirmation_sent_at:'2026-09-25'}],['obfuscated',{id:'fake',identities:[]}],['absent',null]]) {
 test(`${name} no-session response cannot prove email delivery or expose existence`,async()=>{
  assert.equal(await run({data:{user,session:null}}),accountActionRequired);
 });
}
for(const code of ['user_already_exists','email_exists']) test(`${code} uses same neutral state`,async()=>assert.equal(await run({error:{code}}),accountActionRequired));
for (const [code,status,expected] of [['email_address_invalid',400,'INVALID_EMAIL'],['weak_password',422,'WEAK_PASSWORD'],['over_email_send_rate_limit',429,'RATE_LIMIT'],['unexpected_failure',500,'AUTH_FAILED']]) test(`safe explicit error ${code}`,async()=>{
 await assert.rejects(()=>run({error:{code,status,message:'private server detail'}}),new RegExp(expected));
 assert.doesNotMatch(safeAuthMessage(Error(expected)),/private server detail/);
});
test('network failure gives safe connection message',async()=>{
 const c={auth:{signUp:async()=>{throw new TypeError('private request');}}};
 await assert.rejects(()=>advertiserAccountAction(c,'create','a','b'),/NETWORK_ERROR/);
 assert.match(safeAuthMessage(Error('NETWORK_ERROR')),/connection/);
});
const rows=[{id:'allowed'}],u={id:'u'}, valid='I represent this business.';
for(const [name,user,list,id,text,busy,expected] of [
 ['initial',u,rows,'','',false,false],['no user',null,rows,'allowed',valid,false,false],
 ['arbitrary ID',u,rows,'other',valid,false,false],['whitespace',u,rows,'allowed','          ',false,false],
 ['short',u,rows,'allowed','owner',false,false],['too long',u,rows,'allowed','a'.repeat(2001),false,false],
 ['busy',u,rows,'allowed',valid,true,false],['valid',u,rows,'allowed',valid,false,true]
]) test(`claim gate ${name}`,()=>assert.equal(canRequestClaim(user,list,id,text,busy),expected));
test('claim copy, compact authenticated state, selection guard and pending RPC preserved',()=>{
 const s=readFileSync('src/components/AdvertiserAccount.jsx','utf8');
 for(const copy of ['SIGNED IN ✓','SIGN OUT','CLAIM AN EXISTING BUSINESS','How can we verify that you represent this business?','Example: I am the owner.','Do not include passwords or sensitive documents.','REQUEST VERIFICATION']) assert.ok(s.includes(copy),copy);
 assert.match(s,/<BusinessSelector/); assert.match(s,/!user &&/);assert.match(s,/disabled={!canRequestClaim/);
 assert.ok(s.indexOf('if (!canRequestClaim')<s.indexOf("client.rpc('request_business_claim'"));
 assert.match(s,/Ownership has not been granted/);
 const p=readFileSync('src/components/PremiumEvents.jsx','utf8');assert.match(p,/Back to event posting/);assert.match(p,/Close event posting/);
 assert.match(p,/ACCOUNT ACTION REQUIRED/);assert.doesNotMatch(p,/CHECK YOUR EMAIL/);
});
test('no auth secret logging or resend added',()=>{
 const s=readFileSync('src/auth/advertiserSession.mjs','utf8');assert.doesNotMatch(s,/console\.|\.resend\(/);
});
