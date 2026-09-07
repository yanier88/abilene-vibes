/** DESIGN ONLY — no implementation, no Capacitor registration, no real Apple calls.
 * Future native code obtains these proofs itself, not from arbitrary JS input.
 * No TEST/SYNTHETIC adapter may implement a production fallback.
 */
export type Environment = 'Production' | 'Sandbox' | 'Xcode';
export interface VerifiedAppProof {
  verification: 'verified';
  jwsRepresentation: string;
  appTransactionId: string;
  bundleId: string;
  environment: Environment;
  signedDate: number;
  // Device checking performed natively. This boolean alone is not server evidence.
  nativeDeviceCheckPassed: boolean;
}
export interface VerifiedTransactionProof {
  verification: 'verified';
  jwsRepresentation: string;
  transactionId: string;
  originalTransactionId: string;
  appTransactionId?: string;
  appAccountToken?: string;
  productId: string;
  subscriptionGroupIdentifier?: string;
  environment: Environment;
  bundleId: string;
  purchaseDate: number;
  expiresDate?: number;
  revocationDate?: number;
  ownershipType: 'purchased' | 'familyShared';
  // Decoded fields are convenience copies; server verifies the JWS independently.
}
export interface LocalStoreKitBridgeDesign {
  getVerifiedAppTransaction(options?: { userInitiatedRefresh: boolean }): Promise<VerifiedAppProof>;
  getProducts(ids: string[]): Promise<Array<{
    productId: string; displayName: string; displayPrice: string;
    currencyCode: string; subscriptionGroupIdentifier: string;
    periodUnit: string; periodValue: number;
  }>>; // Product catalog is not a JWS proof of a purchase.
  purchase(input: { productId: string; appAccountToken: string; intentCapability: string }): Promise<
    { status: 'verified'; proof: VerifiedTransactionProof } |
    { status: 'pending' | 'userCanceled' | 'unverified' | 'failed'; errorCode?: string }
  >;
  getCurrentEntitlements(): Promise<VerifiedTransactionProof[]>;
  getUnfinishedTransactions(): Promise<VerifiedTransactionProof[]>;
  syncPurchases(): Promise<void>; // Explicit user action, then query entitlements.
  listenForTransactionUpdates(listener: (event:
    { status: 'verified'; proof: VerifiedTransactionProof } |
    { status: 'unverified'; transactionId: string; errorCode: string }
  ) => void): () => void; // NEVER finish automatically; registration returns unsubscribe.
  confirmBackendDelivery(input: {
    transactionId: string; intentId?: string; serverDeliveryProof: string;
  }): Promise<void>; // Native layer validates server-bound acknowledgement first.
  finishTransaction(transactionId: string): Promise<void>; // Refuse without confirmed delivery.
}
export interface InstallationProofDesign {
  getChallenge(purpose: string): Promise<{ nonce: string; expiresAt: number }>;
  attestInstallation(nonce: string): Promise<{ keyId: string; attestationObject: string }>;
  // Internal native operation only; do not expose an arbitrary signing oracle to JS.
  createAssertion(requestHash: string): Promise<{ keyId: string; assertionObject: string }>;
}
