import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const source=readFileSync(new URL('../../src/components/PasswordField.jsx',import.meta.url),'utf8');
const {code}=await transformWithOxc('import React from "react";\n'+source,'PasswordField.jsx',{jsx:{runtime:'classic'}});
const compiled=code.replaceAll('from "react"',`from "${import.meta.resolve('react')}"`);
const {default:PasswordField}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
for(const [name,autoComplete] of [['Sign In','current-password'],['Create Account','new-password']]){
 const html=()=>renderToStaticMarkup(React.createElement(PasswordField,{autoComplete,disabled:false}));
 test(`${name}: hidden initially and accessible show action`,()=>{assert.match(html(),/type="password"/);assert.match(html(),/aria-label="Show password"/);});
 test(`${name}: eye is a non-submit button inside field`,()=>{assert.match(html(),/pe-password-field/);assert.match(html(),/type="button"/);assert.match(html(),/<svg[^>]*aria-hidden="true"/);});
 test(`${name}: autofill unchanged; no controlled password copy`,()=>{assert.match(html(),new RegExp(`autoComplete="${autoComplete}"`));assert.doesNotMatch(html(),/value=/);});
}
test('busy auth disables eye and password together',()=>{const html=renderToStaticMarkup(React.createElement(PasswordField,{autoComplete:'current-password',disabled:true}));assert.equal((html.match(/disabled=""/g)||[]).length,2);});
