import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteUrl, directionsUrl, openBusinessUrl } from '../../src/ios/businessLinks.js';
import { createWeatherLoader, validObservation, weatherMaxAge } from '../../src/ios/weather.js';

for (const [input, expected] of [['https://example.com/a','https://example.com/a'],['http://example.com','http://example.com/'],['www.example.com','https://www.example.com/'],['example.com','https://example.com/'],['  example.com  ','https://example.com/'],[null,''],['',''],['javascript:alert(1)',''],['data:text/html,a',''],['ftp://example.com',''],['https://exa mple.com',''],['https://user:pass@example.com',''],['@guitarsabilene','https://instagram.com/guitarsabilene']]) {
  test(`Website ${JSON.stringify(input)}`,()=>assert.equal(websiteUrl(input),expected));
}
test('Directions coordinates precede address',()=>assert.equal(directionsUrl({latitude:'32.45',longitude:-99.7,address:'Elsewhere'}),'https://maps.apple.com/?daddr=32.45%2C-99.7'));
test('Directions address, no Google app required',()=>assert.equal(directionsUrl({address:'123 Main St, Abilene TX'}),'https://maps.apple.com/?daddr=123%20Main%20St%2C%20Abilene%20TX'));
test('Invalid coordinates fall back to address',()=>assert.match(directionsUrl({latitude:999,longitude:null,address:'Main St'}),/daddr=Main%20St/));
test('Empty data cannot open maps',()=>assert.equal(directionsUrl({latitude:'',longitude:null}),''));
test('Legacy seed without address uses named search',()=>assert.match(directionsUrl({name:'Legacy business'}),/maps.apple.com\/\?q=/));
test('Pending or rejected analytics never block opening',async()=>{
 for(const track of [()=>new Promise(()=>{}),()=>Promise.reject(Error('offline')),()=>{throw Error('offline')}]) {
  const calls=[]; assert.equal(openBusinessUrl({preventDefault(){}},{social:'example.com'},'visits',{open:url=>calls.push(url),track}),true); assert.deepEqual(calls,['https://example.com/']);
 }
 await new Promise(resolve=>setImmediate(resolve));
});
test('Invalid links and opening exceptions do not crash',()=>{
 assert.equal(openBusinessUrl({preventDefault(){}},{social:'javascript:bad'},'visits',{open(){assert.fail()},track(){assert.fail()}}),false);
 assert.equal(openBusinessUrl({preventDefault(){}},{social:'example.com'},'visits',{open(){throw Error()},track(){assert.fail()}}),false);
});
const date=Date.now();
const response=(temp=20,time=date)=>({ok:true,status:200,json:async()=>({properties:{temperature:{value:temp},timestamp:new Date(time).toISOString()}})});
const setup=(fetcher,extra={})=>{const values=[], logs=[];const loader=createWeatherLoader({fetcher,onValue:v=>values.push(v),isDay:()=>true,now:()=>date,retryMs:0,log:v=>logs.push(v),...extra});return {loader,values,logs};};
test('Weather transient cold launch failure recovers once',async()=>{let calls=0;const {loader,values}=setup(async()=>{if(++calls===1)throw Error('private detail');return response()});await loader.load();assert.equal(calls,2);assert.equal(values.at(-1).temp,68);});
test('Weather duplicate concurrent requests and rapid resume deduplicated',async()=>{let calls=0;const {loader}=setup(async()=>{calls++;return response()});await Promise.all([loader.load(),loader.load()]);await loader.load();assert.equal(calls,1);});
test('Weather failed refresh preserves recent cached value; diagnostics sanitized',async()=>{const cached={temp:70,observedAt:new Date(date).toISOString(),isDay:true};const {loader,values,logs}=setup(async()=>{throw Error('secret')},{storage:{getItem:()=>JSON.stringify(cached)}});await loader.load();assert.equal(values.at(-1).temp,70);assert.equal(values.at(-1).status,'error');assert.ok(!JSON.stringify(logs).includes('secret'));});
test('Weather rejects stale, invalid, null and future observations',async()=>{for(const value of [null,NaN,Infinity]){const {loader,values}=setup(async()=>response(value));await loader.load();assert.equal(values.at(-1).temp,null)}assert.equal(validObservation({temp:70,observedAt:'bad'},date),false);assert.equal(validObservation({temp:70,observedAt:new Date(date-weatherMaxAge-1).toISOString()},date),false);assert.equal(validObservation({temp:70,observedAt:new Date(date+60000).toISOString()},date),false);});
test('Weather bounded timeout and rate-limit avoidance',async()=>{let calls=0;const {loader,logs}=setup((url,{signal})=>new Promise((resolve,reject)=>{calls++;signal.addEventListener('abort',()=>reject(Error('aborted')))}),{timeoutMs:5});await loader.load();assert.equal(calls,2);assert.equal(logs.at(-1).result,'timeout');let limited=0;const second=setup(async()=>{limited++;return {ok:false,status:429}});await second.loader.load();assert.equal(limited,1);});
test('Weather foreground refresh after interval and stop suppresses updates',async()=>{let clock=date,calls=0;const {loader,values}=setup(async()=>{calls++;return response()},{now:()=>clock});await loader.load();clock+=600001;await loader.load();assert.equal(calls,2);loader.stop();const count=values.length;await loader.load();assert.equal(values.length,count);});
