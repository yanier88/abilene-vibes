// Supabase Auth is the sole identity authority. Never promote a visitor key.
export async function verifiedAdvertiser(client) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) throw Error('SIGN_IN_REQUIRED');
  const profile = await client.rpc('ensure_advertiser_profile');
  if (profile.error) throw Error('PROFILE_UNAVAILABLE');
  return data.user;
}
export const accountActionRequired = 'If you already have an account, sign in. If you recently created one, check your email for any confirmation message.';

export function safeAuthMessage(error) {
  return ({
    INVALID_EMAIL: 'Enter a valid email address.',
    WEAK_PASSWORD: 'Choose a stronger password with at least 8 characters.',
    RATE_LIMIT: 'Too many attempts. Please wait before trying again.',
    NETWORK_ERROR: 'Unable to connect. Check your connection and try again.',
  })[error?.message] || 'Unable to complete authentication. Check your details and try again.';
}
function safeAuthError(error) {
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code)) return Error('RATE_LIMIT');
  if (error?.code === 'email_address_invalid' || error?.code === 'validation_failed') return Error('INVALID_EMAIL');
  if (error?.code === 'weak_password') return Error('WEAK_PASSWORD');
  if (error instanceof TypeError || error?.name === 'AuthRetryableFetchError') return Error('NETWORK_ERROR');
  return Error('AUTH_FAILED');
}
export async function advertiserAccountAction(client, action, email, password) {
  if (action === 'out') {
    const result = await client.auth.signOut();
    if (result.error) throw Error('SIGN_OUT_FAILED');
    return 'Signed out.';
  }
  const credentials = { email: email.trim(), password };
  let result;
  try { result = action === 'create'
    ? await client.auth.signUp(credentials)
    : await client.auth.signInWithPassword(credentials);
  } catch (error) { throw safeAuthError(error); }
  if (result.error) {
    if (action === 'create' && ['user_already_exists', 'email_exists'].includes(result.error.code)) return accountActionRequired;
    throw safeAuthError(result.error);
  }
  // A no-session signup can be obfuscated for anti-enumeration. Neither identities
  // nor timestamps prove a new account or email delivery; keep one neutral state.
  if (!result.data?.session) return accountActionRequired;
  await verifiedAdvertiser(client);
  return 'Advertiser signed in.';
}
