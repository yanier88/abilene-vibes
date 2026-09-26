export function adminDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  // Same browser-local timezone as the previous toLocaleString display.
  return new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(date);
}
export function adminBadgeText(value) {
  const normalized = String(value || 'unknown').toLowerCase();
  return ({not_required:'No payment required',comp:'Admin Promo / COMP',cancel_pending:'Canceling'})[normalized] || normalized.replaceAll('_',' ');
}
