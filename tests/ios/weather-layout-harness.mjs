// Local-only visual harness: extracts the production badge and styles; never builds the app.
// Run: node tests/ios/weather-layout-harness.mjs --serve [output-directory]
// Open http://127.0.0.1:8768, then run node --test tests/ios/*.test.mjs.
// Browser evidence stays outside the repository and is bound to current source hashes.
import fs from 'node:fs';
import os from 'node:os';
import { createServer } from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.slice(2).find(arg => arg !== '--serve') ?? path.join(os.tmpdir(), 'abilene-weather-layout');
fs.mkdirSync(out, { recursive: true });
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const start = app.indexOf('<button className="weather-widget"');
if (start < 0) throw new Error('Weather badge not found');
let badge = app.slice(start, app.indexOf('</button>', start) + 9)
  .replaceAll('className=', 'class=')
  .replace(/aria-label=\{`Weather in \$\{weather.label\}`\}/, 'aria-label="Weather in Abilene, TX"')
  .replace('{weather.isDay ? "☀" : "☾"}', '☀')
  .replace('{weather.temp === null ? "--" : weather.temp}', 'TEMPERATURE')
  .replace(/\{weather.status === "loading"[\s\S]*?: weather.label\}/, 'Abilene, TX');
if (badge.includes('{')) throw new Error('Unconverted JSX');
const css = ['src/index.css', 'src/App.css'].map(p => fs.readFileSync(path.join(root, p), 'utf8')).join('\n');
const values = [99, 100, 105, 110, 0, -5];
const checks = `
const rect = e => { const r=e.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
const textRect = e => {const r=document.createRange();r.selectNodeContents(e);return rect({getBoundingClientRect:()=>r.getBoundingClientRect()});};
const widget=document.querySelector('.weather-widget'),number=document.querySelector('strong'),label=document.querySelector('.weather-copy span');
const w=rect(widget),n=textRect(number),l=textRect(label),icon=rect(document.querySelector('.weather-icon')),therm=rect(document.querySelector('.weather-thermometer'));
const checks={digitsInside:n.right<=w.right+0.5&&n.left>=w.left,degreePresent:number.textContent.endsWith('°'),labelInside:l.right<=w.right+0.5,separateTextRows:rect(number).bottom<=rect(label).top,noIconOverlap:n.left>=therm.right&&therm.left>=icon.right,noPageOverflow:document.documentElement.scrollWidth<=innerWidth};
parent.postMessage({type:'weather-layout',width:innerWidth,temp:number.textContent,checks,pass:Object.values(checks).every(Boolean),widget:w,number:n,label:l,font:getComputedStyle(number).fontSize,padding:getComputedStyle(widget).padding,columns:getComputedStyle(widget).gridTemplateColumns},'*');
`;
const sourceHashes = Object.fromEntries(["src/App.jsx", "src/App.css", "src/index.css"].map(p => [p, createHash("sha256").update(fs.readFileSync(path.join(root, p))).digest("hex")]));
const frames=[];
for (const width of [440,390]) for (const temp of values) {
 const file=`${width}-${temp}.html`;
 const html=`<!doctype html><html class="capacitor-ios-safe-area"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>${css}</style><div id="root"><main class="app photo-page"><section class="photo-feature lobby-v2"><div class="lobby-title-badge"><span>Lobby</span></div>${badge.replace('TEMPERATURE',String(temp))}</section></main></div><script>requestAnimationFrame(()=>requestAnimationFrame(()=>{${checks}}))</script></html>`;
 fs.writeFileSync(path.join(out,file),html);
 frames.push(`<article><h2>${width}px · ${temp}°</h2><iframe title="${width}px ${temp} degrees" src="${file}" width="${width}" height="${width===440?956:844}" style="height:160px" onload="this.style.height=this.getAttribute('height')+'px'"></iframe></article>`);
}
// Clip the preview only, never the iframe viewport, to compare the unchanged top controls.
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>Weather layout — isolated production CSS</title><style>body{font:14px system-ui;background:#17131e;color:white}#grid{display:grid;grid-template-columns:repeat(2,198px);gap:6px}article{height:104px;overflow:hidden}iframe{transform:scale(.45);transform-origin:top left}h2{font-size:14px}iframe{border:0}pre{white-space:pre-wrap}</style><h1>Weather layout · local only</h1><pre id="results">Waiting for 12 cases</pre><div id="grid">${frames.join('')}</div><script>const results=[];window.addEventListener('message',e=>{if(e.data.type!=='weather-layout')return;results.push(e.data);document.querySelector('#results').textContent=results.length+'/12 cases, '+results.filter(x=>x.pass).length+' PASS\\n'+results.filter(x=>!x.pass).map(x=>x.width+'px '+x.temp+' FAIL '+JSON.stringify(x.checks)).join('\\n');if(results.length===12)fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceHashes:${JSON.stringify(sourceHashes)},cases:results})});});</script>`);
console.log(`Harness generated: ${out}`);

if (process.argv.includes('--serve')) {
  createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/results') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 65536) { res.writeHead(413).end(); return; }
      }
      try {
        const result = JSON.parse(body);
        if (!Array.isArray(result.cases) || result.cases.length !== 12) throw new Error('Incomplete results');
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
        res.writeHead(200).end('Saved local browser evidence');
      } catch { res.writeHead(400).end('Invalid results'); }
      return;
    }
    const name = req.url === '/' ? 'index.html' : String(req.url).slice(1);
    if (req.method !== 'GET' || !/^(index|(?:440|390)--?\d+)\.html$/.test(name)) { res.writeHead(404).end(); return; }
    try {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(out, name)));
    } catch { res.end(); }
  }).listen(8768, '127.0.0.1', () => console.log('Open http://127.0.0.1:8768 for local layout checks'));
}
