import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';
const app=readFileSync('src/App.jsx','utf8');
const css=readFileSync('src/components/AdminWorkspace.css','utf8');
const source=readFileSync('src/components/PasswordField.jsx','utf8');
const {code}=await transformWithOxc('import React from "react";\n'+source,'PasswordField.jsx',{jsx:{runtime:'classic'}});
const {default:Password}=await import('data:text/javascript;base64,'+Buffer.from(code.replaceAll('from "react"',`from "${import.meta.resolve('react')}"`)).toString('base64'));
test('visible login form must be fully actionable after session restoration',()=>{
 const field=app.match(/<PasswordField autoComplete="current-password" disabled=\{([^}]+)\}/)[1];
 assert.doesNotMatch(field,/adminAuthState/);
 assert.match(field,/adminStatus === "signing-in"/);
 assert.match(app,/type="submit" disabled=\{adminStatus === "signing-in" \|\| \(adminWeb && \(!adminEmail.trim\(\) \|\| !adminPassword\)\)\}/);
});
test('controlled Admin password preserves input contract, masking, and non-submit eye',()=>{
 const html=renderToStaticMarkup(React.createElement(Password,{autoComplete:'current-password',disabled:false,inputProps:{value:'synthetic-only',onChange(){},minLength:undefined,placeholder:'Password'}}));
 assert.match(html,/type="password"/);assert.match(html,/value="synthetic-only"/);assert.match(html,/placeholder="Password"/);
 assert.match(html,/type="button"/);assert.match(html,/aria-label="Show password"/);assert.doesNotMatch(html,/disabled|readonly/);
});
test('business and job plan colors use semantic plan values, not moderation status',()=>{
 assert.equal((app.match(/data-plan=\{adminWeb \? String\(business.plan/g)||[]).length,3);
 assert.match(app,/strong data-plan=\{String\(business.plan/);
 assert.match(app,/data-plan=\{index === 0 \? String\(value\).toLowerCase\(\) : undefined\}/);
 for(const status of ['approved','pending','expired','hidden'])assert.match(css,new RegExp(`data-status=${status}`));
});
function luminance(hex){return hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
test('three plan palettes are distinct and exceed WCAG AA small-text contrast',()=>{
 const palettes=['premium','featured','free'].map(plan=>{
  const rule=css.match(new RegExp(`\\[data-plan=${plan}\\] \\{([^}]+)`))[1];
  const bg=rule.match(/background:#(\w{6})/)[1], fg=rule.match(/;color:#(\w{6})/)[1];
  assert.ok((luminance(fg)+.05)/(luminance(bg)+.05)>=4.5,plan);
  return fg;
 });assert.equal(new Set(palettes).size,3);
});
