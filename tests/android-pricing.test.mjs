import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { promotionPlansFor, promotionPriceFor, promotionCheckoutPayload } from '../src/billing/promotionCatalog.mjs';
import { resolvePricing, resolveLineItem, applyLineItem, validateAndroidPrice } from '../supabase/functions/create-checkout-session/pricing.mjs';

for (const [platform, expected] of [['android', [0,2499,6799]], ['web',[0,1900,5900]], ['ios',[0,1900,5900]]]) {
  test(`${platform}: catalog and display amounts`, () => {
    const plans=promotionPlansFor(platform);
    assert.deepEqual(plans.map(p=>p.amountCents),expected);
    assert.deepEqual(plans.map(p=>p.displayPrice), platform==='android'?['$0','$24.99','$67.99']:['$0','$19','$59']);
    assert.deepEqual(plans.map(p=>p.interval),[null,'month','month']);
    assert.match(plans[1].note,/auto-renews until canceled/);
    assert.equal(promotionPriceFor(platform,'Premium'),plans[2].displayPrice);
  });
}
test('Android payload adds catalog, web/iOS do not; paid plan required',()=>{
  for(const plan of ['Featured','Premium']) {
    const body={plan,submissionId:'fixture'};
    assert.deepEqual(promotionCheckoutPayload('android',body),{...body,catalog:'android_v2'});
    for(const platform of ['web','ios']) assert.deepEqual(promotionCheckoutPayload(platform,body),body);
  }
  for(const plan of ['Free','premium','constructor','Other']) assert.throws(()=>promotionCheckoutPayload('android',{plan}));
});
test('pricing input rejects unknown catalog/plan and amount or Price overrides',()=>{
  for(const catalog of ['other','constructor','__proto__','',null,{}]) assert.throws(()=>resolvePricing({catalog,plan:'Premium'}));
  for(const plan of ['Free','premium','constructor','__proto__',null]) assert.throws(()=>resolvePricing({catalog:'android_v2',plan}));
  for(const key of ['amount','amountCents','unit_amount','price','priceId','price_id']) {
    assert.throws(()=>resolvePricing({catalog:'android_v2',plan:'Premium',[key]:1}));
    assert.throws(()=>promotionCheckoutPayload('android',{plan:'Premium',[key]:1}));
  }
});
for(const catalog of [undefined,'android_v2']) for(const plan of ['Featured','Premium']) {
  test(`${catalog ?? 'legacy'} ${plan}: exact server fallback and no legacy leakage`,async()=>{
    const p=resolvePricing({catalog,plan});
    const amount=catalog==='android_v2'?(plan==='Featured'?2499:6799):(plan==='Featured'?1900:5900);
    assert.equal(p.amount,amount);
    const item=await resolveLineItem(p, name=>catalog==='android_v2' && ['STRIPE_FEATURED_PRICE_ID','STRIPE_PREMIUM_PRICE_ID'].includes(name)?'price_legacy':undefined,'fixture',()=>{throw Error('network forbidden');});
    const params=new URLSearchParams(); applyLineItem(params,item,'fixture','monthly');
    assert.equal(params.get('line_items[0][price_data][unit_amount]'),String(amount));
    assert.equal(params.get('line_items[0][price_data][currency]'),'usd');
    assert.equal(params.get('line_items[0][price_data][recurring][interval]'),'month');
    assert.equal(params.get('line_items[0][quantity]'),'1');
    assert.equal(params.has('line_items[0][price]'),false);
  });
}
const validPrice=(plan)=>({id:'price_fixture',active:true,type:'recurring',currency:'usd',unit_amount:plan==='Featured'?2499:6799,recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',transform_quantity:null});
for(const plan of ['Featured','Premium']) test(`validate configured ${plan} Android Price`,async()=>{
  const p=resolvePricing({catalog:'android_v2',plan}); let calls=0;
  const item=await resolveLineItem(p,key=>{assert.equal(key,`STRIPE_ANDROID_${plan.toUpperCase()}_PRICE_ID`);return 'price_fixture';},'fixture',async url=>{assert.equal(url,'https://api.stripe.com/v1/prices/price_fixture');calls++; return Response.json(validPrice(plan));});
  const params=new URLSearchParams();applyLineItem(params,item,'fixture','monthly');
  assert.equal(calls,1);assert.equal(params.get('line_items[0][price]'),'price_fixture');assert.equal(params.has('line_items[0][price_data][unit_amount]'),false);
  for(const patch of [{active:false},{unit_amount:1900},{currency:'eur'},{type:'one_time'},{recurring:{interval:'year'}},{recurring:{interval:'month',interval_count:2}},{transform_quantity:{divide_by:2}},{billing_scheme:'tiered'}]) assert.throws(()=>validateAndroidPrice({...validPrice(plan),...patch},p,'price_fixture'));
  await assert.rejects(resolveLineItem(p,()=> 'price_fixture','fixture',async()=>new Response('',{status:404})));
});

test('real handler: all four branches, both plans and catalogs use exact line items (mock network only)',async()=>{
  let handler;const oldDeno=globalThis.Deno, oldFetch=globalThis.fetch;
  const env={STRIPE_SECRET_KEY:'fixture-only',APP_PUBLIC_URL:'https://example.invalid',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only'};
  globalThis.Deno={env:{get:key=>env[key]},serve:fn=>{handler=fn;}};
  try {
    await import('../supabase/functions/create-checkout-session/index.ts');
    for(const catalog of [undefined,'android_v2']) for(const plan of ['Featured','Premium']) for(const branch of ['rental','create job','existing job','business']) {
      let params;let writes=0;
      globalThis.fetch=async(url,options={})=>{
        if(url==='https://api.stripe.com/v1/checkout/sessions') {params=new URLSearchParams(options.body);return Response.json({id:'cs_fixture',url:'https://example.invalid/checkout'});}
        assert.ok(url.startsWith('https://fixture.invalid/rest/v1/'),url);
        if(options.method==='PATCH'){writes++;return new Response(null,{status:204});}
        if(options.method==='POST') return Response.json([{id:'listing_fixture',...JSON.parse(options.body)}]);
        return Response.json([{id:'listing_fixture',plan:branch==='business'?plan:plan.toLowerCase(),status:'pending',payment_status:'pending'}]);
      };
      const body={plan,...(catalog?{catalog}:{}), ...(branch==='rental'?{listingType:'rental',action:'create_and_checkout',rentalPayload:{title:'fixture',address:'fixture',owner_user_id:'fixture'}}:branch==='create job'?{listingType:'job',action:'create_and_checkout',jobPayload:{title:'fixture',company:'fixture'}}:branch==='existing job'?{listingType:'job',jobId:'listing_fixture'}:{submissionId:'listing_fixture'})};
      const result=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify(body)}));
      assert.equal(result.status,200,`${catalog}/${plan}/${branch}: ${JSON.stringify(await result.json())}`);
      assert.equal(params.get('mode'),'subscription');
      assert.equal(params.get('line_items[0][price_data][unit_amount]'),String(resolvePricing(body).amount));
      assert.equal(params.get('line_items[0][price_data][currency]'),'usd');
      assert.equal(params.get('line_items[0][price_data][recurring][interval]'),'month');
      assert.equal(params.get('line_items[0][quantity]'),'1');
      assert.equal(params.get('metadata[plan]'),plan); assert.equal(writes,1);
    }
    env.STRIPE_ANDROID_PREMIUM_PRICE_ID='price_fixture';
    let priceChecks=0;
    globalThis.fetch=async url=>{
      assert.equal(url,'https://api.stripe.com/v1/prices/price_fixture'); priceChecks++;
      return Response.json({...validPrice('Premium'),unit_amount:5900});
    };
    const blocked=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({catalog:'android_v2',plan:'Premium',submissionId:'fixture'})}));
    assert.equal(blocked.status,503);assert.equal(priceChecks,1);
    delete env.STRIPE_ANDROID_PREMIUM_PRICE_ID;
    globalThis.fetch=()=>{throw Error('Invalid request reached network');};
    for(const body of [{plan:'Free'},{plan:'Other'},{plan:'Featured',catalog:'unknown'},{plan:'Premium',catalog:'android_v2',amount:1}]) {
      const result=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify(body)})); assert.equal(result.status,400);
    }
  } finally {globalThis.fetch=oldFetch;globalThis.Deno=oldDeno;}
});

test('UI integrations share catalog, every Checkout uses wrapper, Apple native entry remains separate',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(app,/\$19\b|\$59\b/);
  assert.equal((app.match(/invokePromotionCheckout\(supabase,/g)||[]).length,4);
  assert.equal((app.match(/functions.invoke\("create-checkout-session"/g)||[]).length,1);
  for(const label of ['promotionPrice(selectedPlan)','promotionPrice("Featured")','promotionPrice("Premium")']) assert.ok(app.includes(label));
  const apple=app.slice(app.indexOf('if (page === "promote" && isIOS())'),app.indexOf('if (page === "promote")'));
  assert.match(apple,/<ApplePromotionPurchase\b[^>]*bridge=\{applePromotionPlans\}/);
  const applePurchase=readFileSync(new URL('../src/components/ApplePromotionPurchase.jsx',import.meta.url),'utf8');
  assert.match(applePurchase,/await bridge\.open\(\{accessToken:r\.data\.session\.access_token,listingType:listing\.listing_type,listingId:listing\.id\}\)/);
  assert.doesNotMatch(apple+'\n'+applePurchase,/invokePromotionCheckout|create-checkout-session|android_v2/);
  const gate=readFileSync(new URL('../ios/App/App/SandboxCaptureGate.swift',import.meta.url),'utf8');
  for(const name of ['featured','premium']) assert.ok(gate.includes(`com.abilenevibes.app.promotion.slot01.${name}.monthly`));
});
