// Supabase Auth is the sole identity authority. Never promote a visitor key.
export async function verifiedAdvertiser(client) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) throw Error('SIGN_IN_REQUIRED');
  const profile = await client.rpc('ensure_advertiser_profile');
  if (profile.error) throw Error('PROFILE_UNAVAILABLE');
  return data.user;
}
export async function advertiserAccountAction(client, action, email, password) {
  if (action === 'out') {
    const result = await client.auth.signOut();
    if (result.error) throw Error('SIGN_OUT_FAILED');
    return 'Signed out.';
  }
  const credentials = { email: email.trim(), password };
  const result = action === 'create'
    ? await client.auth.signUp(credentials)
    : await client.auth.signInWithPassword(credentials);
  if (result.error) throw Error('AUTH_FAILED');
  if (!result.data?.session) return 'Check your email to confirm your account, then sign in.';
  await verifiedAdvertiser(client);
  return 'Advertiser signed in.';
}
