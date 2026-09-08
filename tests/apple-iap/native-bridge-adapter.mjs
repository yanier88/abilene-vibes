/** LOCAL LAB ADAPTER ONLY. Mapping is not JWS verification or delivery authority. */
export function mapNativeTransaction(event) {
  if (event.status === 'pending') return { status: 'pending' };
  if (event.status === 'userCancelled') return { status: 'userCanceled' };
  if (event.status === 'unverified') return { status: 'unverified', errorCode: event.errorCode };
  if (event.status === 'error') return { status: 'failed', errorCode: event.errorCode };
  const proof = event.proof;
  if (event.status !== 'verified' || proof?.verification !== 'verified'
    || typeof proof.jwsRepresentation !== 'string' || !proof.jwsRepresentation
    || !['Production', 'Sandbox', 'Xcode'].includes(proof.environment)
    || ['transactionId', 'originalTransactionId', 'productId', 'bundleId'].some(key => !proof[key])) {
    throw new Error('Incomplete native evidence; server verification/derivation required');
  }
  return { status: 'verified', proof: { ...proof } };
}
