import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {verifyArtifact,expected} from '../../scripts/commercial-deploy/verify-artifact.mjs';
const now=Date.now();
const protocol={nonce:'synthetic-nonce',installed_at:new Date(now-1000).toISOString(),expected_project:expected.project,expected_function:expected.function,expected_source_hash:expected.files['supabase/functions/stripe-webhook/index.ts'],activated_at:null};
const metadata={id:expected.id,slug:expected.function,version:25,status:'ACTIVE',updated_at:now-500,ezbr_sha256:'a'.repeat(64),verify_jwt:false,import_map:false};
test('verifier hashes all three remote source/dependency files, binds deployment metadata',()=>{
 const evidence=verifyArtifact(metadata,{...metadata},readFileSync,protocol,now);assert.equal(evidence.source_hash,protocol.expected_source_hash);assert.equal(evidence.version,25);assert.equal(evidence.manifest_hash.length,64);
});
for(const [name,patch] of Object.entries({old_version:{version:24},wrong_function:{slug:'wrong'},wrong_identity:{id:'wrong'},inactive:{status:'INACTIVE'},pre_protocol:{updated_at:now-2000},future:{updated_at:now+1},import_map:{import_map:true},jwt_drift:{verify_jwt:true}}))test('verifier rejects '+name,()=>assert.throws(()=>verifyArtifact({...metadata,...patch},{...metadata,...patch},readFileSync,protocol,now)));
test('verifier rejects changing deployment during download',()=>assert.throws(()=>verifyArtifact(metadata,{...metadata,version:26},readFileSync,protocol,now),/REMOTE_CHANGED/));
for(const path of Object.keys(expected.files))test('verifier rejects modified dependency '+path,()=>assert.throws(()=>verifyArtifact(metadata,metadata,p=>p===path?Buffer.from('altered'):readFileSync(p),protocol,now),/ARTIFACT_MISMATCH/));
test('verifier rejects wrong protocol scope',()=>assert.throws(()=>verifyArtifact(metadata,metadata,readFileSync,{...protocol,expected_project:'other'},now),/PROTOCOL_SCOPE/));
