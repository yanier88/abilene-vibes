import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformWithOxc} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const source=readFileSync('src/components/AdminOwnershipClaims.jsx','utf8');
const {code}=await transformWithOxc('import React from "react";\n'+source,'AdminOwnershipClaims.jsx',{jsx:{runtime:'classic'}});
const compiled=code.replaceAll('from "react"',`from "${import.meta.resolve('react')}"`);
const {default:Claims}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const props={claims:[{id:'synthetic',business_id:'b',created_at:'2026-09-25T03:56:28Z',evidence:'Synthetic verification explanation'}],businesses:[{id:'b',business_name:'Synthetic Business'}],busy:false,onReview:()=>{throw Error('No live actions');}};
test('pending claim name explanation time and review controls rendered',()=>{
 const html=renderToStaticMarkup(React.createElement(Claims,props));
 for(const text of ['Synthetic Business','Synthetic verification explanation','Status: pending','2026-09-25T03:56:28Z','Approve Claim','Reject Claim','1','pending'])assert.ok(html.includes(text));
});
test('saving disables both review actions',()=>{const html=renderToStaticMarkup(React.createElement(Claims,{...props,busy:true}));assert.equal((html.match(/disabled=""/g)||[]).length,2);});
test('empty queue is explicit',()=>assert.match(renderToStaticMarkup(React.createElement(Claims,{...props,claims:[]})),/No pending business claims/));
test('dedicated category and shortcut; loader still queries pending and review uses RPC',()=>{
 const s=readFileSync('src/App.jsx','utf8');assert.match(s,/id: "claims", label: "Ownership Claims"/);assert.match(s,/OWNERSHIP CLAIMS \(\{pendingClaims.length\} pending\)/);
 assert.match(s,/from\("business_ownership_claims"\).*eq\("status", "pending"\)/);
 assert.match(s,/rpc\("review_business_claim"/);assert.match(s,/loadAdminData\(adminSession, true\)/);
 assert.match(s,/supabase && adminSession &&/);
});
test('CSS exposes claims only in dedicated tab and preserves responsive scroll',()=>{
 const s=readFileSync('src/App.css','utf8');assert.match(s,/\.admin-panel-view-claims \.admin-tab-claims \{ display: grid/);assert.match(s,/overflow-x: auto/);assert.match(s,/\.admin-toolbar \{ flex-wrap: wrap/);
});
