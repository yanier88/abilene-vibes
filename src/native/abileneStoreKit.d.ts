import type { PluginListenerHandle } from '@capacitor/core';

export interface TransactionProof {
  verification: 'verified';
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  bundleId: string;
  jwsRepresentation: string;
  environment?: string; // Omitted on iOS 15; server must derive from verified JWS.
  appTransactionId?: string; // StoreKit can return an empty/unavailable identifier.
  appAccountToken?: string;
  subscriptionGroupIdentifier?: string;
  ownershipType: string;
  isUpgraded: boolean;
  purchaseDate: number;
  signedDate: number;
  expiresDate?: number;
  revocationDate?: number;
  revocationReason?: number;
}
export type TransactionEvent =
  | { status: 'verified'; proof: TransactionProof; localDeliveryConfirmation?: { transactionId: string; receipt: string } }
  | { status: 'unverified'; transactionId: string; errorCode: string };
export interface AbileneStoreKitBridge {
  getVerifiedAppTransaction(): Promise<{
    status: 'verified'; localTestEnabled?: boolean; proof: {
      verification: 'verified'; jwsRepresentation: string; bundleId: string;
      environment: string; appTransactionId?: string; appId?: string;
      signedDate: number; appVersion: string;
    };
  } | { status: 'unverified'; errorCode: string }>;
  getProducts(options: { productIds: string[] }): Promise<{ products: Array<{
    id: string; displayName: string; description: string; displayPrice: string;
    price: string; currencyCode: string; subscriptionGroupIdentifier?: string;
    subscriptionPeriod?: { unit: string; value: number };
  }> }>;
  purchase(options: { productId: string; appAccountToken: string }): Promise<
    TransactionEvent | { status: 'pending' | 'userCancelled' } | { status: 'error'; errorCode: string }
  >;
  getCurrentEntitlements(): Promise<{ transactions: TransactionEvent[] }>;
  getUnfinishedTransactions(): Promise<{ transactions: TransactionEvent[] }>;
  syncPurchases(): Promise<{ entitlements: TransactionEvent[]; unfinished: TransactionEvent[] }>;
  addListener(event: 'transactionUpdate', listener: (event: TransactionEvent) => void): Promise<PluginListenerHandle>;
  startTransactionUpdates(): Promise<{ started: boolean }>;
  stopTransactionUpdates(): Promise<void>;
  finishTransaction(options: {
    transactionId: string;
    deliveryConfirmation: { transactionId: string; receipt: string };
  }): Promise<{ finished: true; transactionId: string }>;
}
export function getAbileneStoreKit(): AbileneStoreKitBridge;
