// Local/prepared backend domain. No network, Apple call, listing write or finish.
export const BUNDLE = 'com.abilenevibes.app';
export const TABLES = ['buyers','installations','capabilities','challenges','catalog','grants','intents','slots','subscriptions','assignments','transactions','notifications','entitlements','deliveries'];
export class AppleError extends Error {
  constructor(code, status = 409) { super(code); this.code = code; this.status = status; }
}
export const requireThat = (ok, code, status) => { if (!ok) throw new AppleError(code, status); };
export const uuid = () => crypto.randomUUID();
export const iso = ms => new Date(ms).toISOString();
export const time = value => Date.parse(value);
export const sha256 = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function exactInput(input, keys) {
  requireThat(input && typeof input === 'object' && !Array.isArray(input), 'INVALID_INPUT',400);
  requireThat(Object.keys(input).every(k=>keys.includes(k)) && keys.every(k=>typeof input[k]==='string' && input[k].length>0 && input[k].length<=65536), 'INVALID_INPUT',400);
}
export function sandbox(environment) {
  requireThat(environment === 'Sandbox', 'ENVIRONMENT_DISABLED',503); // No runtime switch enables Production/Xcode.
}
export function emptyState() { return Object.fromEntries(TABLES.map(k=>[k,[]])); }
export function candidateCatalog(environment='Sandbox', enabled=false) {
  return Array.from({length:10},(_,i)=>['featured','premium'].map(plan=>({
    product_id:`${BUNDLE}.promotion.slot${String(i+1).padStart(2,'0')}.${plan}.monthly`,
    slot_number:i+1,plan,subscription_group_id:null,bundle_id:BUNDLE,environment,enabled,created_at:iso(0)
  }))).flat();
}
export function listingFor(s, buyer, kind, id, now) {
  requireThat(['business','job','rental'].includes(kind),'INVALID_LISTING_TYPE',400);
  const l=s.listings?.find(x=>x.listing_type===kind && x.listing_id===id);
  requireThat(l,'LISTING_NOT_FOUND',404);
  requireThat(['pending','approved'].includes(l.status),'LISTING_INELIGIBLE');
  requireThat(s.grants.some(g=>g.buyer_id===buyer.id && g.environment===buyer.environment && g.listing_type===kind && g.listing_id===id && !g.revoked_at && time(g.expires_at)>now),'LISTING_UNAUTHORIZED',403);
  requireThat(!l.stripe_conflict,'STRIPE_CONFLICT');
  return l;
}
export function authenticate(s, tokenHash, scope, now) {
  const c=s.capabilities.find(x=>x.token_hash===tokenHash);
  requireThat(c && !c.revoked_at && time(c.expires_at)>now && c.scope.includes(scope),'CAPABILITY_REJECTED',401);
  const i=s.installations.find(x=>x.installation_id===c.installation_id && x.buyer_id===c.buyer_id && x.environment===c.environment);
  const b=s.buyers.find(x=>x.id===c.buyer_id && x.environment===c.environment);
  requireThat(i && !i.revoked_at && i.attestation_status==='verified' && b?.status==='active','IDENTITY_REJECTED',401);
  sandbox(b.environment);
  return {buyer:b,installation:i,capability:c};
}
export function reserve(s, auth, input, now) {
  exactInput(input,['listing_type','listing_id','requested_plan','idempotency_key']);
  requireThat(['featured','premium'].includes(input.requested_plan),'INVALID_PLAN',400);
  requireThat(input.idempotency_key.length<=128,'INVALID_IDEMPOTENCY_KEY',400);
  const b=auth.buyer;
  listingFor(s,b,input.listing_type,input.listing_id,now);
  const prior=s.intents.find(i=>i.buyer_id===b.id && i.environment===b.environment && i.idempotency_key===input.idempotency_key);
  if(prior) {
    requireThat(['listing_type','listing_id','requested_plan'].every(k=>prior[k]===input[k]),'IDEMPOTENCY_CONFLICT');
    return prior;
  }
  requireThat(!s.slots.some(x=>x.environment===b.environment && x.listing_type===input.listing_type && x.listing_id===input.listing_id),'APPLE_CONFLICT');
  const used=new Set(s.slots.filter(x=>x.buyer_id===b.id && x.environment===b.environment).map(x=>x.slot_number));
  const slot=Array.from({length:10},(_,i)=>i+1).find(n=>!used.has(n));
  requireThat(slot,'NO_SLOT_AVAILABLE');
  const p=s.catalog.find(p=>p.bundle_id===BUNDLE && p.environment===b.environment && p.slot_number===slot && p.plan===input.requested_plan && p.enabled && p.subscription_group_id);
  requireThat(p,'CATALOG_NOT_CONFIGURED',503);
  const i={id:uuid(),buyer_id:b.id,listing_type:input.listing_type,listing_id:input.listing_id,requested_plan:input.requested_plan,slot_number:slot,product_id:p.product_id,environment:b.environment,idempotency_key:input.idempotency_key,status:'reserved',created_at:iso(now),expires_at:iso(now+600000),started_at:null,completed_at:null,reconciliation_reason:null};
  s.intents.push(i);
  s.slots.push({buyer_id:b.id,environment:b.environment,slot_number:slot,state:'reserved',purchase_intent_id:i.id,subscription_id:null,listing_type:i.listing_type,listing_id:i.listing_id,updated_at:iso(now)});
  return i;
}
export function start(s, auth, intentId, now) {
  const i=s.intents.find(x=>x.id===intentId && x.buyer_id===auth.buyer.id && x.environment===auth.buyer.environment);
  requireThat(i,'INTENT_NOT_FOUND',404);
  requireThat(i.status==='reserved' && time(i.expires_at)>now,'INTENT_NOT_STARTABLE');
  i.status='purchasing'; i.started_at=iso(now);
  s.slots.find(x=>x.purchase_intent_id===i.id).state='purchasing';
  return i;
}
export function validateTransaction(t, b, i, catalog, now) {
  sandbox(t.environment);
  requireThat(t.bundle_id===BUNDLE && t.environment===b.environment,'TRANSACTION_SCOPE');
  requireThat(typeof t.transaction_id==='string' && /^\d+$/.test(t.transaction_id) && typeof t.original_transaction_id==='string' && /^\d+$/.test(t.original_transaction_id),'TRANSACTION_IDS');
  requireThat(t.app_account_token===b.app_account_token && t.app_transaction_id===b.app_transaction_id && b.app_transaction_id,'BUYER_MISMATCH');
  requireThat(t.product_id===i.product_id,'PRODUCT_MISMATCH');
  const p=catalog.find(p=>p.product_id===t.product_id && p.environment===b.environment && p.bundle_id===BUNDLE && p.enabled);
  requireThat(p && p.subscription_group_id && t.subscription_group_id===p.subscription_group_id,'GROUP_MISMATCH');
  requireThat(t.ownership_type==='PURCHASED' && !t.is_upgraded && !t.revocation_date,'TRANSACTION_NOT_ELIGIBLE');
  requireThat(Number.isFinite(time(t.purchase_date)) && time(t.purchase_date)<=now+30000 && time(t.expires_date)>time(t.purchase_date) && time(t.expires_date)>now,'TRANSACTION_DATES');
  requireThat(i.started_at && time(t.purchase_date)>=time(i.started_at)-30000,'INTENT_NOT_STARTED');
  return p;
}
export function conflict(s,i,reason,now) {
  i.status='reconciliation'; i.reconciliation_reason=reason;
  const slot=s.slots.find(x=>x.purchase_intent_id===i.id);
  if(slot) {slot.state='reconciliation';slot.updated_at=iso(now);}
  return {status:'reconciliation',reason};
}
export function deliverApplePurchase(s,auth,i,t,hash,now) {
  const prior=s.transactions.find(x=>x.bundle_id===t.bundle_id && x.environment===t.environment && x.transaction_id===t.transaction_id);
  if(prior) {
    const d=s.deliveries.find(x=>x.transaction_id===t.transaction_id && x.environment===t.environment && x.bundle_id===t.bundle_id);
    requireThat(d && d.purchase_intent_id===i.id && d.buyer_id===auth.buyer.id && ['original_transaction_id','product_id','app_account_token','app_transaction_id','purchase_date','expires_date','subscription_group_id','ownership_type','is_upgraded','revocation_date','revocation_reason'].every(k=>prior[k]===t[k]),'TRANSACTION_REPLAY_CONFLICT');
    return {status:'already_delivered',delivery:d};
  }
  requireThat(['purchasing','pending','verifying'].includes(i.status),'INTENT_STATE');
  const p=validateTransaction(t,auth.buyer,i,s.catalog,now);
  const known=s.subscriptions.find(x=>x.bundle_id===BUNDLE && x.environment===t.environment && x.original_transaction_id===t.original_transaction_id);
  if(known) {
    const a=s.assignments.find(x=>x.subscription_id===known.id);
    if(known.buyer_id!==auth.buyer.id || !a || a.listing_type!==i.listing_type || a.listing_id!==i.listing_id || known.slot_number!==i.slot_number) return conflict(s,i,'CHAIN_LISTING_CONFLICT',now);
    // Renewals go through notifications/reconciliation, never infer a new purchase intent.
    return conflict(s,i,'KNOWN_CHAIN_REQUIRES_RECONCILIATION',now);
  }
  listingFor(s,auth.buyer,i.listing_type,i.listing_id,now);
  const sub={id:uuid(),buyer_id:auth.buyer.id,bundle_id:BUNDLE,environment:t.environment,slot_number:i.slot_number,product_id:t.product_id,plan:p.plan,subscription_group_id:p.subscription_group_id,original_transaction_id:t.original_transaction_id,current_transaction_id:t.transaction_id,status:'active',auto_renew_enabled:null,period_start:t.purchase_date,period_end:t.expires_date,grace_period_expires_at:null,verified_at:iso(now),last_reconciled_at:null,created_at:iso(now),updated_at:iso(now),last_event_signed_date:0};
  const a={id:uuid(),subscription_id:sub.id,buyer_id:sub.buyer_id,slot_number:sub.slot_number,environment:sub.environment,listing_type:i.listing_type,listing_id:i.listing_id,purchase_intent_id:i.id,first_transaction_id:t.transaction_id,assigned_at:iso(now),closed_at:null,closure_reason:null};
  const d={id:uuid(),bundle_id:BUNDLE,environment:t.environment,transaction_id:t.transaction_id,buyer_id:sub.buyer_id,purchase_intent_id:i.id,assignment_id:a.id,created_at:iso(now)};
  s.subscriptions.push(sub);s.assignments.push(a);s.deliveries.push(d);
  s.transactions.push({...t,subscription_id:sub.id,assignment_id:a.id,signed_payload_ref:null,signed_payload_sha256:hash,verification_status:'verified',verified_at:iso(now),created_at:iso(now)});
  s.entitlements.push({id:uuid(),listing_type:i.listing_type,listing_id:i.listing_id,provider:'apple',provider_reference:sub.id,plan:p.plan,status:'active',valid_from:t.purchase_date,valid_until:t.expires_date,auto_renew_state:'unknown',environment:t.environment,source_priority:100,created_at:iso(now),updated_at:iso(now)});
  i.status='completed';i.completed_at=iso(now);
  Object.assign(s.slots.find(x=>x.purchase_intent_id===i.id),{state:'occupied',subscription_id:sub.id,updated_at:iso(now)});
  return {status:'delivered',delivery:d};
}
