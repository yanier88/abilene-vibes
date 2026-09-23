import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifyAndroidStripeBaseline} from './android-stripe-preservation-loader.mjs';
const raw=fs.readFileSync(new URL('./android-stripe-preservation-baseline-v1.json',import.meta.url));
const root=process.cwd(),reject=e=>e.message==='ANDROID_STRIPE_BASELINE_REJECTED';
test('baseline missing protected path rejects',()=>assert.throws(()=>verifyAndroidStripeBaseline(root,raw,()=>{throw Error('missing');}),reject));
test('baseline modified protected bytes reject',()=>assert.throws(()=>verifyAndroidStripeBaseline(root,raw,()=>Buffer.from('modified')),reject));
for(const [name,mutate] of [['unexpected schema',m=>m.schemaVersion++],['wrong Git blob/hash',m=>{m.entries[0].gitBlob='0'.repeat(40);m.entries[0].sha256='0'.repeat(64);}],['missing provenance',m=>delete m.entries[0].provenance]])test('baseline '+name+' rejects',()=>{const m=JSON.parse(raw);mutate(m);assert.throws(()=>verifyAndroidStripeBaseline(root,Buffer.from(JSON.stringify(m))),reject);});
