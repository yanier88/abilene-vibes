import {BUNDLE,AppleError,requireThat,sandbox,iso} from './domain.mjs';
export class UnconfiguredAppleVerifier {
  async verifyTransaction() {throw new AppleError('APPLE_VERIFIER_NOT_CONFIGURED',503);}
  async verifyNotification() {throw new AppleError('APPLE_VERIFIER_NOT_CONFIGURED',503);}
}
// Adapter around an OFFICIAL SignedDataVerifier instance constructed on the server
// with trusted Apple root certificates, online checks, bundle and environment.
// Not wired into Edge entry points. No JWS decode-without-verification fallback.
export class OfficialAppleVerifierAdapter {
  constructor(signedDataVerifier) {this.verifier=signedDataVerifier;}
  normalize(t) {
    sandbox(t.environment);
    requireThat(t.bundleId===BUNDLE,'APPLE_BUNDLE_MISMATCH');
    return {environment:t.environment,bundle_id:t.bundleId,transaction_id:t.transactionId,original_transaction_id:t.originalTransactionId,product_id:t.productId,
      app_account_token:t.appAccountToken,app_transaction_id:t.appTransactionId,subscription_group_id:t.subscriptionGroupIdentifier,
      purchase_date:iso(t.purchaseDate),expires_date:iso(t.expiresDate),revocation_date:t.revocationDate==null?null:iso(t.revocationDate),revocation_reason:t.revocationReason??null,
      ownership_type:t.inAppOwnershipType,is_upgraded:t.isUpgraded??false};
  }
  async verifyTransaction(jws,appJws) {
    requireThat(this.verifier,'APPLE_VERIFIER_NOT_CONFIGURED',503);
    const t=await this.verifier.verifyAndDecodeTransaction(jws);
    const a=await this.verifier.verifyAndDecodeAppTransaction(appJws);
    requireThat(a.bundleId===BUNDLE && a.receiptType===t.environment && a.appTransactionId && a.appTransactionId===t.appTransactionId,'APP_TRANSACTION_MISMATCH');
    return this.normalize(t);
  }
  async verifyNotification(jws) {
    requireThat(this.verifier,'APPLE_VERIFIER_NOT_CONFIGURED',503);
    const n=await this.verifier.verifyAndDecodeNotification(jws);
    requireThat(n.data?.signedTransactionInfo,'NOTIFICATION_EVIDENCE_MISSING');
    const t=await this.verifier.verifyAndDecodeTransaction(n.data.signedTransactionInfo);
    const normalized=this.normalize(t);
    requireThat(n.data.bundleId===BUNDLE && n.data.environment===normalized.environment,'NOTIFICATION_SCOPE');
    const renewal=n.data.signedRenewalInfo?await this.verifier.verifyAndDecodeRenewalInfo(n.data.signedRenewalInfo):null;
    if(renewal)requireThat(renewal.environment===t.environment && renewal.originalTransactionId===t.originalTransactionId,'RENEWAL_SCOPE');
    return {bundle_id:BUNDLE,environment:t.environment,notification_uuid:n.notificationUUID,notification_type:n.notificationType,subtype:n.subtype??null,signed_date:n.signedDate,
      original_transaction_id:t.originalTransactionId,transaction_id:t.transactionId,product_id:t.productId,app_account_token:t.appAccountToken,app_transaction_id:t.appTransactionId,
      period_start:normalized.purchase_date,period_end:normalized.expires_date,auto_renew_enabled:renewal?.autoRenewStatus===undefined?null:renewal.autoRenewStatus===1,
      grace_period_expires_at:renewal?.gracePeriodExpiresDate==null?null:iso(renewal.gracePeriodExpiresDate),transaction:normalized};
  }
}
