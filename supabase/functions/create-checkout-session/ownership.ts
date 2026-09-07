// No Stripe behavior here. Public-key requests keep legacy ownership; real user
// tokens must be validated by Supabase Auth, never by decoding client claims.
export class CheckoutAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) { super(message); this.status = status; }
}
export async function resolveCheckoutOwner(
  request: Request,
  config: { supabaseUrl: string; anonKey: string; publishableKey?: string },
  send: typeof fetch = fetch,
): Promise<string | null> {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) throw new CheckoutAuthError('Invalid authorization header.');
  const token = match[1];
  // Match exact server-configured public keys, not a JWT role claim or a prefix.
  if ([config.anonKey, config.publishableKey].filter(Boolean).includes(token)) return null;
  // Production's existing frontend public key is still accepted by PostgREST,
  // but differs from the Edge runtime's injected key. Pin that exact public key
  // by SHA-256; never infer anonymous access from unverified JWT claims.
  if (config.supabaseUrl === 'https://ymgiwjuhgvfexitynmtb.supabase.co') {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (fingerprint === 'c286419aecb1e5a5bb250de1db1df00cf9a69d8b5df2d380bc7b084e55d77e4c') return null;
  }
  if (!config.anonKey || !config.supabaseUrl) throw new CheckoutAuthError('Authentication configuration unavailable.', 503);
  let response: Response;
  try {
    response = await send(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
    });
  } catch { throw new CheckoutAuthError('Authentication service unavailable.', 503); }
  if (response.status >= 500 || response.status === 429) throw new CheckoutAuthError('Authentication service unavailable.', 503);
  if (!response.ok) throw new CheckoutAuthError('Invalid or expired session.');
  let user: { id?: unknown; is_anonymous?: boolean };
  try { user = await response.json(); }
  catch { throw new CheckoutAuthError('Invalid authentication response.', 503); }
  if (!user || typeof user.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id) || user.is_anonymous) {
    throw new CheckoutAuthError('A recoverable account is required.');
  }
  return user.id;
}
export function verifiedOwnership(
  payload: Record<string, unknown> | null,
  userId: string | null,
): Record<string, unknown> | null {
  if (!payload) return null;
  const safe = { ...payload };
  // Defense in depth even though the existing financial sanitizers exclude this.
  delete safe.advertiser_user_id;
  if (userId) {
    safe.owner_user_id = userId;
    safe.advertiser_user_id = userId;
  }
  return safe;
}
