import {BUNDLE,requireThat,sandbox,iso,uuid} from './domain.mjs';
const TYPES=['SUBSCRIBED','DID_RENEW','DID_CHANGE_RENEWAL_STATUS','DID_FAIL_TO_RENEW','GRACE_PERIOD_EXPIRED','EXPIRED','REFUND','REVOKE'];
export function recordNotification(s,event,hash,now) {
  sandbox(event.environment);
  requireThat(event.bundle_id===BUNDLE && typeof event.notification_uuid==='string' && event.notification_uuid.length>0 && Number.isFinite(event.signed_date) && event.signed_date<=now+30000,'NOTIFICATION_SCOPE');
  const prior=s.notifications.find(x=>x.environment===event.environment && x.notification_uuid===event.notification_uuid);
  if(prior) {requireThat(prior.payload_hash===hash,'NOTIFICATION_REPLAY_CONFLICT');return prior;}
  const n={id:uuid(),environment:event.environment,notification_uuid:event.notification_uuid,notification_type:event.notification_type,subtype:event.subtype??null,signed_date:event.signed_date,payload_hash:hash,payload_ref:null,status:'received',attempts:0,received_at:iso(now),processed_at:null,error_code:null,
    // Sanitized verified facts only; never raw JWS. Backend-only RLS.
    facts:structuredClone(event)};
  s.notifications.push(n); return n;
}
export function processNotification(s,n,now) {
  if(['processed','quarantined'].includes(n.status)) return n;
  n.attempts++;n.status='processing';
  const e=n.facts;
  const sub=s.subscriptions.find(x=>x.bundle_id===BUNDLE && x.environment===e.environment && x.original_transaction_id===e.original_transaction_id);
  if(!sub) {n.status='retry';n.error_code='ASSIGNMENT_NOT_YET_KNOWN';return n;}
  const buyer=s.buyers.find(x=>x.id===sub.buyer_id);
  const a=s.assignments.find(x=>x.subscription_id===sub.id);
  const product=s.catalog.find(x=>x.product_id===e.product_id && x.environment===e.environment && x.enabled);
  if(!TYPES.includes(e.notification_type) || !product || product.slot_number!==sub.slot_number || product.subscription_group_id!==sub.subscription_group_id || e.app_account_token!==buyer.app_account_token || e.app_transaction_id!==buyer.app_transaction_id || !a) {
    n.status='quarantined';n.error_code='UNMATCHED_VERIFIED_FACTS';return n;
  }
  const quarantine=(code,block=false)=>{
    n.status='quarantined';n.error_code=code;
    if(block){sub.status='reconciliation';const ent=s.entitlements.find(x=>x.provider_reference===sub.id);if(ent)ent.status='reconciliation';}
    return n;
  };
  if(e.signed_date<=sub.last_event_signed_date) return quarantine('OUT_OF_ORDER_RECONCILIATION',['REFUND','REVOKE'].includes(e.notification_type));
  if(!['SUBSCRIBED','DID_RENEW'].includes(e.notification_type) && e.transaction_id!==sub.current_transaction_id) return quarantine('NONCURRENT_TRANSACTION_RECONCILIATION',true);
  // Do not infer chronology from arrival order. Unknown history remains blocked.
  if(sub.status==='revoked' && !['REFUND','REVOKE'].includes(e.notification_type)) {n.status='quarantined';n.error_code='REVOKED_CHAIN_RECONCILIATION';return n;}
  let status=sub.status;
  switch(e.notification_type) {
    case 'SUBSCRIBED': case 'DID_RENEW':
      if(!e.transaction || e.transaction.ownership_type!=='PURCHASED' || e.transaction.revocation_date || e.transaction.is_upgraded || e.transaction.transaction_id!==e.transaction_id || e.transaction.original_transaction_id!==sub.original_transaction_id || e.transaction.product_id!==product.product_id || e.transaction.environment!==sub.environment || e.transaction.bundle_id!==BUNDLE || e.transaction.app_account_token!==buyer.app_account_token || e.transaction.app_transaction_id!==buyer.app_transaction_id || e.transaction.subscription_group_id!==sub.subscription_group_id || e.transaction.purchase_date!==e.period_start || e.transaction.expires_date!==e.period_end || !Number.isFinite(Date.parse(e.period_start)) || !Number.isFinite(Date.parse(e.period_end)) || Date.parse(e.period_end)<=Date.parse(e.period_start) || Date.parse(e.period_end)<Date.parse(sub.period_end) || !e.transaction_id) {
        n.status='quarantined';n.error_code='PERIOD_RECONCILIATION';return n;
      }
      const existing=s.transactions.find(x=>x.environment===e.environment && x.bundle_id===BUNDLE && x.transaction_id===e.transaction_id);
      if(existing && (existing.subscription_id!==sub.id || existing.assignment_id!==a.id || ['product_id','original_transaction_id','purchase_date','expires_date','app_account_token','app_transaction_id'].some(k=>existing[k]!==e.transaction[k])))return quarantine('TRANSACTION_CONFLICT',true);
      status=Date.parse(e.period_end)>now?'active':'expired';
      if(!s.transactions.some(x=>x.environment===e.environment && x.bundle_id===BUNDLE && x.transaction_id===e.transaction_id)) {
        s.transactions.push({...e.transaction,subscription_id:sub.id,assignment_id:a.id,signed_payload_ref:null,signed_payload_sha256:n.payload_hash,verification_status:'verified',verified_at:iso(now),created_at:iso(now)});
        s.deliveries.push({id:uuid(),bundle_id:BUNDLE,environment:e.environment,transaction_id:e.transaction_id,buyer_id:sub.buyer_id,purchase_intent_id:a.purchase_intent_id,assignment_id:a.id,created_at:iso(now)});
      }
      sub.period_start=e.period_start;sub.period_end=e.period_end;sub.current_transaction_id=e.transaction_id;
      sub.product_id=product.product_id;sub.plan=product.plan;
      break;
    case 'DID_CHANGE_RENEWAL_STATUS':
      if(typeof e.auto_renew_enabled!=='boolean'){n.status='quarantined';n.error_code='MISSING_RENEWAL_STATUS';return n;}
      sub.auto_renew_enabled=e.auto_renew_enabled;
      if(['active','active_nonrenewing'].includes(status))status=e.auto_renew_enabled?'active':'active_nonrenewing';
      break;
    case 'DID_FAIL_TO_RENEW':
      status=Date.parse(e.grace_period_expires_at)>now?'grace':'billing_retry';
      sub.grace_period_expires_at=e.grace_period_expires_at??null;break;
    case 'GRACE_PERIOD_EXPIRED': status='billing_retry';break;
    case 'EXPIRED': status='expired';break;
    case 'REFUND': case 'REVOKE': status='revoked';break;
  }
  sub.status=status;sub.last_event_signed_date=e.signed_date;sub.updated_at=iso(now);sub.last_reconciled_at=iso(now);
  const entitlement=s.entitlements.find(x=>x.provider==='apple' && x.provider_reference===sub.id && x.environment===sub.environment);
  if(entitlement) Object.assign(entitlement,{plan:sub.plan,status,valid_from:sub.period_start,valid_until:status==='grace'?sub.grace_period_expires_at:sub.period_end,auto_renew_state:sub.auto_renew_enabled===null?'unknown':sub.auto_renew_enabled?'enabled':'disabled',updated_at:iso(now)});
  // Never release a slot, reassign a listing, or write any business row.
  n.status='processed';n.processed_at=iso(now);n.error_code=null;return n;
}
export function reconcile(s,now) {
  for(const n of s.notifications.filter(x=>['received','retry'].includes(x.status)).sort((a,b)=>a.signed_date-b.signed_date)) processNotification(s,n,now);
  for(const i of s.intents) {
    if(i.status!=='completed' && Date.parse(i.expires_at)<=now) {
      i.status='reconciliation';i.reconciliation_reason='EXPIRED_INTENT_NO_TERMINAL_EVIDENCE';
      const slot=s.slots.find(x=>x.purchase_intent_id===i.id);if(slot)slot.state='reconciliation';
    }
  }
  return {pending:s.notifications.filter(x=>x.status!=='processed').length,reconciliation:s.intents.filter(x=>x.status==='reconciliation').length};
}
export class UnconfiguredAppleServerAPI {
  async subscriptionStatus() {throw new Error('APPLE_SERVER_API_NOT_CONFIGURED');}
  async transactionHistory() {throw new Error('APPLE_SERVER_API_NOT_CONFIGURED');}
}
