import { Capacitor, registerPlugin } from '@capacitor/core';

// Deliberately not imported by the current checkout/UI. No web/Android fallback.
const native = registerPlugin('AbileneStoreKit');
export function getAbileneStoreKit() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    throw new Error('AbileneStoreKit is available only in native iOS');
  }
  return native;
}
