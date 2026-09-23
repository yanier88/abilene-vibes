// Public identifiers confirmed by the owner in App Store Connect.
// Environment is chosen by trusted server composition, never a request boolean.
export const APPLE_POLICY=Object.freeze({appAppleId:6811679667,bundleId:'com.abilenevibes.app',subscriptionGroupId:'22382531'});
export const APPLE_PRODUCTS=Object.freeze([
 Object.freeze({product:'com.abilenevibes.app.promotion.slot01.featured.monthly',group:'22382531',plan:'featured',level:2,slot:1}),
 Object.freeze({product:'com.abilenevibes.app.promotion.slot01.premium.monthly',group:'22382531',plan:'premium',level:1,slot:1})
]);
export function serverPolicy(environment='Production'){
 if(!['Production','Sandbox'].includes(environment))throw Error('ENVIRONMENT_DISABLED');
 return Object.freeze({...APPLE_POLICY,environment,catalog:APPLE_PRODUCTS});
}
