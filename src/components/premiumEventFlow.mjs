import { eventEligibility } from './premiumEvents.mjs';

// Options come exclusively from the existing owner-scoped backend RPC.
export function businessPostingStep(options, businessId) {
  if (!options.length) return 'none';
  const selected = options.find(b => b.business_id === businessId);
  if (!selected) return 'choose';
  const gate = eventEligibility(selected);
  if (!gate.premium) return 'premium';
  if (gate.full) return 'full';
  return gate.allowed ? 'form' : 'unavailable';
}

export async function loadPostingContext(client) {
  if (!client) throw Error('UNAVAILABLE');
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return { authenticated: false, options: [], own: [] };
  const [options, own] = await Promise.all([
    client.rpc('premium_event_options'),
    client.from('event_submissions').select('id,title,status').eq('submitted_by', data.user.id).order('created_at', { ascending: false }),
  ]);
  if (options.error || own.error) throw Error('UNAVAILABLE');
  return { authenticated: true, options: options.data ?? [], own: own.data ?? [] };
}

export function canRequestClaim(user, businesses, business, evidence, busy) {
  return !!user && !busy && businesses.some(b => b.id === business) && evidence.trim().length >= 10 && evidence.length <= 2000;
}
