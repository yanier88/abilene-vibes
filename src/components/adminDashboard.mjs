export const adminGroups = [
  {label: 'Workspace', ids: ['dashboard']},
  {label: 'Content', ids: ['events', 'gallery', 'businesses']},
  {label: 'Moderation', ids: ['claims', 'marketplace', 'jobs', 'rentals', 'reviews']},
  {label: 'Commerce', ids: ['payments']},
  {label: 'Insights', ids: ['analytics']},
];
export function adminCounters(data) {
  const pending = rows => rows.filter(row => row.status === 'pending').length;
  return {
    events: data.pendingEvents.length, businesses: data.pendingBusinesses.length,
    claims: data.pendingClaims.length, gallery: data.pendingGalleryPhotos.length,
    reviews: data.pendingReviews.length,
    marketplace: data.adminMarketplaceListings.filter(row => (row.moderation_status ?? row.moderationStatus) === 'pending').length,
    jobs: pending(data.adminJobListings), rentals: pending(data.adminRentalListings),
  };
}
export const adminDescriptions = {
  dashboard: 'Your workspace at a glance. Review what needs attention.',
  events: 'Review submissions, manage published events and add new listings.',
  gallery: 'Review community photos and curate the published gallery.',
  businesses: 'Manage listings, publishing status and promotions.',
  claims: 'Verify business ownership before approving access.',
  marketplace: 'Review listings and manage their public visibility.',
  jobs: 'Manage hiring listings, moderation and existing plans.',
  rentals: 'Manage housing listings and their publishing status.',
  reviews: 'Review community feedback before publication.',
  payments: 'Payment records, earnings and promotional placements.',
  analytics: 'Activity and engagement from your existing reports.',
};
