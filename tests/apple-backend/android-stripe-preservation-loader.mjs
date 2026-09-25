// Test-only independent immutable baseline; no temporary evidence at runtime.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const manifestUrl=new URL('./android-stripe-preservation-baseline-v1.json',import.meta.url);
const PIN='8871959e942ab71fca05ed4c82d9e09741a61ba90f186dec3b58467f8ef2e0cc';
const digest=b=>createHash('sha256').update(b).digest('hex');
export function verifyAndroidStripeBaseline(root,raw=fs.readFileSync(manifestUrl),read=p=>fs.readFileSync(path.join(root,p))) {
 const reject=()=>{throw Error('ANDROID_STRIPE_BASELINE_REJECTED');};
 try{
  if(digest(raw)!==PIN)reject();
  const m=JSON.parse(raw);
  if(m.schemaVersion!==1||m.entries.length!==65)reject();
  const deltaBytes=fs.readFileSync(new URL('./phase102-provider-delta.json',import.meta.url));
  if(digest(deltaBytes)!=='09c75709f94f9b7740222180ac3b90f37f4c70248b4664f9f7c56febf60a38ce')reject();
  const delta=JSON.parse(deltaBytes);if(delta.schemaVersion!==1||delta.entries.length!==3)reject();
  const finalBytes=fs.readFileSync(new URL('./phase112-provider-delta.json',import.meta.url));
  if(digest(finalBytes)!=='39c14ee47c21774dbc4827fcd8e7b5457445319ca819017d1813fbbddc7a898a')reject();
  const finalDelta=JSON.parse(finalBytes);
  if(finalDelta.schemaVersion!==1||finalDelta.entries.length!==1)reject();
  const final=finalDelta.entries[0];
  if(final.path!=='supabase/functions/_shared/apple/domain.mjs'||final.beforeSHA256!==delta.entries.find(e=>e.path===final.path)?.afterSHA256)reject();
  const closureBytes=fs.readFileSync(new URL('./phase112-production-provider-delta.json',import.meta.url));
  if(digest(closureBytes)!=='7619133cdbc96edcd3531bfbf0f100624c32d79e7363b1d116bccbf2005adcdb')reject();
  const closure=JSON.parse(closureBytes);
  const closurePaths=["src/App.jsx", "supabase/functions/_shared/apple/domain.mjs", "supabase/functions/_shared/apple/backend.mjs", "supabase/functions/_shared/apple/repository.mjs", "supabase/functions/_shared/apple/reconciliation.mjs"];
  if(closure.schemaVersion!==1||closure.entries.length!==5||new Set(closure.entries.map(e=>e.path)).size!==5||closure.entries.some(e=>!closurePaths.includes(e.path)))reject();
  const premiumBytes=fs.readFileSync(new URL('./premium-events-provider-delta.json',import.meta.url));
  if(digest(premiumBytes)!=='c929d833265eda589d9614dcd2cee62ed28f8d845207d5fff2a9b29a071bbd93')reject();
  const premium=JSON.parse(premiumBytes);
  const premiumPaths=['src/App.jsx','supabase/functions/stripe-webhook/index.ts'];
  if(premium.schemaVersion!==1||premium.entries.length!==2||new Set(premium.entries.map(e=>e.path)).size!==2||premium.entries.some(e=>!premiumPaths.includes(e.path)))reject();
  for(const e of m.entries){
   const approved=delta.entries.find(d=>d.path===e.path);
   if(approved&&(e.baselineType!=='PRESERVED_HASH'||approved.beforeSHA256!==e.sha256||!['supabase/functions/_shared/apple/domain.mjs','supabase/functions/_shared/apple/backend.mjs','supabase/functions/_shared/apple/repository.mjs'].includes(e.path)))reject();
   const previous=e.path===final.path?final.afterSHA256:(approved?.afterSHA256??e.sha256);
   const update=closure.entries.find(d=>d.path===e.path);
   if(update&&update.beforeSHA256!==previous)reject();
   const addition=premium.entries.find(d=>d.path===e.path);
   const prior=update?.afterSHA256??previous;
   if(addition&&addition.beforeSHA256!==prior)reject();
   if(!e.provenance||digest(read(e.path))!==(addition?.afterSHA256??prior))reject();
   if(e.baselineType==='GIT_BLOB'){
    const b=execFileSync('git',['cat-file','blob',e.gitBlob],{cwd:root});
    if(digest(b)!==e.sha256)reject();
   }else if(e.baselineType!=='PRESERVED_HASH')reject();
  }
  return m.entries.length;
 }catch{reject();}
}
