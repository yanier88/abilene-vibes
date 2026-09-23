import {requireThat,validateTransactionFacts,intentBinding,listingFor,time,iso,uuid} from './domain.mjs';
export const EXPIRED='VERIFIED_EXPIRED_UNDELIVERED';
export function reconcileExpired(s,a,i,t,payloadHash,appHash,signedDate,now){
 intentBinding(a,i);listingFor(s,a.buyer,i.listing_type,i.listing_id,now);
 validateTransactionFacts(t,a.buyer,i,s.catalog,now);
 requireThat(time(t.expires_date)<=now,'TRANSACTION_NOT_EXPIRED');
 requireThat(Number.isSafeInteger(signedDate)&&signedDate>=time(t.purchase_date)&&signedDate<=now+30000,'TRANSACTION_SIGNED_DATE');
 requireThat(!s.transactions.some(x=>x.bundle_id===t.bundle_id&&x.environment===t.environment&&x.transaction_id===t.transaction_id),'TRANSACTION_ALREADY_DELIVERED');
 const rows=s.expired_purchases??(s.expired_purchases=[]);
 const prior=rows.find(x=>x.bundle_id===t.bundle_id&&x.environment===t.environment&&x.transaction_id===t.transaction_id);
 const facts={provider:'apple',bundle_id:t.bundle_id,environment:t.environment,transaction_id:t.transaction_id,original_transaction_id:t.original_transaction_id,buyer_id:a.buyer.id,installation_id:a.installation.installation_id,listing_type:i.listing_type,listing_id:i.listing_id,app_account_token:t.app_account_token,app_transaction_id:t.app_transaction_id,product_id:t.product_id,subscription_group_id:t.subscription_group_id,purchase_date:t.purchase_date,signed_date:iso(signedDate),expiration_date:t.expires_date,purchase_intent_id:i.id,evidence_sha256:payloadHash,app_evidence_sha256:appHash,verification_status:'verified',commercial_status:'expired_undelivered',reason:'PERIOD_EXPIRED_BEFORE_DURABLE_DELIVERY'};
 if(prior){requireThat(Object.entries(facts).every(([k,v])=>prior[k]===v),'RECOVERY_BINDING_MISMATCH');return {status:'verified_expired_undelivered',commercialState:EXPIRED,reconciliation_id:prior.id,deliveryGranted:false,finishAuthorized:false};}
 requireThat(['purchasing','pending','verifying'].includes(i.status),'INTENT_STATE');
 requireThat(!rows.some(x=>x.purchase_intent_id===i.id||x.bundle_id===t.bundle_id&&x.environment===t.environment&&x.original_transaction_id===t.original_transaction_id),'RECOVERY_LINEAGE_CONFLICT');
 requireThat(!s.subscriptions.some(x=>x.bundle_id===t.bundle_id&&x.environment===t.environment&&x.original_transaction_id===t.original_transaction_id),'RECOVERY_LINEAGE_CONFLICT');
 const row={id:uuid(),...facts,created_at:iso(now),reconciled_at:iso(now)};rows.push(row);
 i.status='reconciliation';i.reconciliation_reason='VERIFIED_EXPIRED_UNDELIVERED';
 const slot=s.slots.find(x=>x.purchase_intent_id===i.id);requireThat(slot,'SLOT_BINDING_REQUIRED');
 slot.state='released_expired';slot.updated_at=iso(now);
 return {status:'verified_expired_undelivered',commercialState:EXPIRED,reconciliation_id:row.id,deliveryGranted:false,finishAuthorized:false};
}
