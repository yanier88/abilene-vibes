import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {eventEligibility} from '../../src/components/premiumEvents.mjs';
for(const platform of ['Android','iPhone']) {
 for(const provider of [null,'stripe','apple','admin_comp'])for(const occupied of [0,2,3])test(`${platform} ${provider??'Free/Featured'} slots=${occupied}`,()=>assert.equal(eventEligibility({provider,occupied,can_submit:provider!==null&&occupied<3}).allowed,provider!==null&&occupied<3));
}
test('UI consumes server can_submit fail closed',()=>assert.equal(eventEligibility({provider:'stripe',occupied:0,can_submit:false}).allowed,false));
test('Events component cannot initiate payment',()=>{const s=readFileSync('src/components/PremiumEvents.jsx','utf8');assert.doesNotMatch(s,/Product\.purchase|create-checkout|apple-iap|StoreKit|functions\.invoke/);});
