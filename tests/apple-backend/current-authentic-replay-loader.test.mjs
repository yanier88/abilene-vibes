import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadCurrentAuthenticReplay} from './current-authentic-replay-loader.mjs';
const source=process.env.ABILENE_AUTHENTIC_FIXTURE_DIR;
const rejected=e=>e.message==='AUTHENTIC_FIXTURE_REJECTED';
test('authentic fixture independently pinned and historical only',()=>{
 const f=loadCurrentAuthenticReplay(source);
 assert.equal(f.classification,'AUTHENTIC_APPLE_HISTORICAL');
 assert.equal(f.NOW,1789523793134);
 assert.equal(f.manifest.expected.deliveryGranted,false);
 assert.equal(f.manifest.expected.finishCalled,false);
});
const cases=[];
for(const [label,file] of [['Transaction JWS','transactionJws.jws'],['AppTransaction','appTransactionJws.jws'],['root','rootDer.der'],['leaf OCSP','leafResponse.der'],['intermediate OCSP','intermediateResponse.der']]){
 cases.push(['missing '+label,d=>fs.unlinkSync(path.join(d,'inputs',file))]);
 cases.push(['modified '+label,d=>{const p=path.join(d,'inputs',file),b=fs.readFileSync(p);b[0]^=1;fs.writeFileSync(p,b);}]);
}
const manifestChange=(name,change)=>cases.push([name,d=>{const p=path.join(d,'manifest.json'),m=JSON.parse(fs.readFileSync(p));change(m);fs.writeFileSync(p,JSON.stringify(m));}]);
manifestChange('manifest hash mismatch',m=>m.inputs[0].sha256='0'.repeat(64));
manifestChange('size mismatch',m=>m.inputs[0].size++);
manifestChange('wrong fixtureId',m=>m.fixtureId='DIAGNOSTIC');
manifestChange('wrong schemaVersion',m=>m.schemaVersion=2);
manifestChange('wrong policyVersion',m=>m.policyVersion='wrong');
for(const key of ['productId','subscriptionGroupId','bundleId','environment'])manifestChange('wrong '+key,m=>m.mapping[key]='wrong');
for(const [name,mutate] of cases)test('tamper rejects: '+name,()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'phase94-negative-'));fs.chmodSync(d,0o700);
 try{
  fs.cpSync(path.join(source,'inputs'),path.join(d,'inputs'),{recursive:true});fs.chmodSync(path.join(d,'inputs'),0o700);
  fs.copyFileSync(path.join(source,'manifest.json'),path.join(d,'manifest.json'));fs.chmodSync(path.join(d,'manifest.json'),0o600);
  for(const f of fs.readdirSync(path.join(d,'inputs')))fs.chmodSync(path.join(d,'inputs',f),0o600);
  mutate(d);assert.throws(()=>loadCurrentAuthenticReplay(d),rejected);
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('explicit directory required; no default or historical fallback',()=>assert.throws(()=>loadCurrentAuthenticReplay(undefined),rejected));
