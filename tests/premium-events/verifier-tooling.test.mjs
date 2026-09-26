import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {resolveExecutable,canonicalDownloadArgs,requireCanonicalDownload} from '../../scripts/commercial-deploy/tooling.mjs';
const dir=mkdtempSync(join(tmpdir(),'verifier-path-test-'));
test.after(()=>rmSync(dir,{recursive:true,force:true}));
test('canonical download always specifies server API',()=>assert.deepEqual(requireCanonicalDownload(canonicalDownloadArgs('stripe-webhook','ymgiwjuhgvfexitynmtb')),['functions','download','stripe-webhook','--project-ref','ymgiwjuhgvfexitynmtb','--use-api']));
test('omitting canonical flag refuses continuation',()=>assert.throws(()=>requireCanonicalDownload(['functions','download','stripe-webhook']),/CANONICAL_API/));
for(const name of ['SUPABASE','PSQL']){
 test(`${name} missing configured path rejects`,()=>assert.throws(()=>resolveExecutable(name),/ABSOLUTE_EXECUTABLE/));
 test(`${name} relative PATH lookup rejects`,()=>assert.throws(()=>resolveExecutable(name,name.toLowerCase()),/ABSOLUTE_EXECUTABLE/));
 test(`${name} absent absolute executable rejects`,()=>assert.throws(()=>resolveExecutable(name,join(dir,'missing')),/EXECUTABLE_UNAVAILABLE/));
}
test('non executable file rejects',()=>{const p=join(dir,'noexec');writeFileSync(p,'synthetic',{mode:0o600});assert.throws(()=>resolveExecutable('TEST',p),/EXECUTABLE_UNAVAILABLE/);});
test('directory rejects',()=>assert.throws(()=>resolveExecutable('TEST',dir),/EXECUTABLE_UNAVAILABLE/));
test('explicit existing executable resolves without downloads',()=>assert.equal(resolveExecutable('NODE',process.execPath),resolve(process.execPath)));
