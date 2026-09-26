import { eventEligibility } from './premiumEvents.mjs';
export function selectorRows(businesses, mode = 'claim', search = '') {
  const term = search.trim().toLocaleLowerCase();
  return businesses.map(b => {
    const gate = eventEligibility(b);
    return { id: mode === 'claim' ? b.id : b.business_id, name: b.business_name,
      locked: mode === 'post' && !gate.allowed,
      reason: mode !== 'post' || gate.allowed ? '' : gate.full ? 'Event limit reached' : 'Premium required' };
  }).filter(b => String(b.name || '').toLocaleLowerCase().includes(term));
}
export function selectableBusiness(businesses, mode, id) {
  return selectorRows(businesses, mode).some(b => b.id === id && !b.locked);
}
