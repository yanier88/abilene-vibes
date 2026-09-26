export default function AdminOwnershipClaims({claims, businesses, busy, onReview}) {
  return <section className="admin-section admin-tab-claims" aria-label="Pending business claims">
    <h2>OWNERSHIP CLAIMS ({claims.length} pending)</h2>
    <p>Approve only after independently verifying the claimant's authority. Matching contact details alone do not prove ownership.</p>
    {claims.map(claim => <article className="admin-card" key={claim.id}>
      <h3>{businesses.find(b => b.id === claim.business_id)?.business_name || 'Business unavailable'}</h3>
      <p>Status: pending</p>
      <p>Submitted: <time dateTime={claim.created_at}>{new Date(claim.created_at).toLocaleString()}</time></p>
      <p>{claim.evidence}</p>
      <div className="admin-claim-actions">
        <button type="button" disabled={busy} onClick={() => onReview(claim, 'approved')}>Approve Claim</button>
        <button type="button" disabled={busy} onClick={() => onReview(claim, 'rejected')}>Reject Claim</button>
      </div>
    </article>)}
    {!claims.length && <p>No pending business claims.</p>}
  </section>;
}
