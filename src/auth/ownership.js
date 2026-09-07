// A matching legacy UUID is a device capability, not an authenticated claim.
export function classifyListing(row, userId, visitorKey) {
  if (row?.advertiser_user_id) return row.advertiser_user_id === userId ? 'authenticated' : 'other';
  const owner = row?.owner_user_id ?? row?.ownerUserId;
  return owner && owner === visitorKey ? 'legacy' : 'other';
}
export function canManageListing(row, userId, visitorKey) {
  return classifyListing(row, userId, visitorKey) !== 'other';
}
