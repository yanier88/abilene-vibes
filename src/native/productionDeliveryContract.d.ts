/** DESIGN ONLY. No production verifier, transport or finish authority is installed. */
export interface ProductionDeliveryConfirmation {
  kind: 'abilene.apple.delivery.v1';
  signed_jws: string; // Backend ES256 JWS; never Apple transaction JWS or TEST HMAC.
}
/** Untrusted until signature, audience, bindings, time and nonce have been validated. */
export interface ProductionDeliveryClaims {
  iss: 'abilene-apple-delivery';
  aud: 'com.abilenevibes.app';
  schema_version: 1;
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  buyer_id: string;
  appAccountToken: string;
  buyer_capability_id: string; // Public capability record ID, not the bearer secret.
  purchase_intent_id: string;
  listing_type: 'business' | 'job' | 'rental';
  listing_id: string;
  environment: 'Production' | 'Sandbox'; // Explicitly separate future policies; Xcode prohibited.
  issued_at: number; // Integer Unix seconds; identical to iat.
  iat: number;
  exp: number;
  jti: string; // Random one-time delivery-confirmation nonce.
  delivery_status: 'delivered' | 'already_delivered';
  delivery_id: string; // Durable idempotent backend delivery record.
  installation_key_id: string;
  request_nonce: string;
}
