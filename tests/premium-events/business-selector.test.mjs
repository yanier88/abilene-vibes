import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectorRows,selectableBusiness} from '../../src/components/businessSelector.mjs';
for (const plan of ['Free','Featured','Premium']) test(`claim ${plan} selectable, no entitlement inferred`,()=>assert.equal(selectableBusiness([{id:'a',business_name:'Alpha',plan}], 'claim','a'),true));
for(const name of ['Free','Featured','fake Premium','expired','revoked','canceled']) test(`post ${name} locked without server authority`,()=>{
 const rows=[{business_id:'a',business_name:'Alpha',plan:name,provider:null,can_submit:false}];
 assert.equal(selectableBusiness(rows,'post','a'),false);assert.equal(selectorRows(rows,'post')[0].reason,'Premium required');
});
test('unknown ID and wrong owner omitted by backend cannot be selected',()=>assert.equal(selectableBusiness([],'post','foreign'),false));
for(const provider of ['stripe','apple','admin_comp'])for(const occupied of [0,1,2,3])test(`${provider} ${occupied} slots`,()=>{
 assert.equal(selectableBusiness([{business_id:'a',business_name:'Alpha',provider,occupied,can_submit:occupied<3}],'post','a'),occupied<3);
});
test('server denial wins over provider label',()=>assert.equal(selectableBusiness([{business_id:'a',provider:'stripe',can_submit:false}],'post','a'),false));
test('search case insensitive, no results, clear restores only supplied list',()=>{
 const rows=[{id:'a',business_name:'Alpha'},{id:'b',business_name:'Beta'}];
 assert.deepEqual(selectorRows(rows,'claim',' ALP ').map(b=>b.id),['a']);
 assert.equal(selectorRows(rows,'claim','foreign').length,0);assert.equal(selectorRows(rows,'claim','').length,2);
});
test('presentation has focus, Escape, Cancel, non-submit actions and checkmark',()=>{
 const s=readFileSync('src/components/BusinessSelector.jsx','utf8');
 for(const part of ["e.key === 'Enter'",'role="dialog"','aria-expanded={open}',"e.key === 'Escape'",'Cancel','Clear search','No results','aria-pressed','aria-label="Selected"','✓','searchInput.current?.focus()','trigger.current?.focus()'])assert.ok(s.includes(part),part);
 assert.doesNotMatch(s,/<button(?![^>]*type="button")/g);
 assert.doesNotMatch(s,/\.rpc\(|\.from\(|fetch\(/);
});
test('compact green status, two-line names, scrolling and 44px controls',()=>{
 const s=readFileSync('src/components/PremiumEvents.css','utf8');
 for(const part of ['color: #85d7aa','-webkit-line-clamp: 2','overflow-y: auto','min-height: 44px','background: #fffefa','color: #237449'])assert.ok(s.includes(part));
});
