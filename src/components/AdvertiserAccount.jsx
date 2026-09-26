import BusinessSelector from './BusinessSelector.jsx';
import { useEffect, useState } from 'react';
import { advertiserAccountAction, verifiedAdvertiser, safeAuthMessage } from '../auth/advertiserSession.mjs';
import { canRequestClaim } from './premiumEventFlow.mjs';
export default function AdvertiserAccount({ client }) {
  const [user, setUser] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [business, setBusiness] = useState(''), [evidence, setEvidence] = useState('');
  const [businesses, setBusinesses] = useState([]), [claims, setClaims] = useState([]);
  useEffect(() => {
    if (!client) return;
    let active = true, revision = 0;
    async function restore() {
      const ticket = ++revision;
      try {
        const { data, error } = await client.auth.getUser();
        if (!active || ticket !== revision) return;
        const current = error ? null : data?.user;
        setUser(current); setBusinesses([]); setClaims([]); setBusiness(''); setEvidence('');
        if (!current) return;
        await verifiedAdvertiser(client);
        const [b, c] = await Promise.all([
          client.from('business_submissions').select('id,business_name').eq('status','approved').is('advertiser_user_id', null).order('business_name'),
          client.from('business_ownership_claims').select('id,business_id,status').eq('claimant',current.id),
        ]);
        if (!active || ticket !== revision) return;
        if (b.error || c.error) throw Error();
        setBusinesses(b.data ?? []); setClaims(c.data ?? []);
      } catch { if (active && ticket === revision) setMessage('Advertiser services are unavailable. Please retry.'); }
    }
    void restore();
    const { data } = client.auth.onAuthStateChange(() => { setTimeout(() => { if (active) void restore(); }, 0); });
    return () => { active = false; revision++; data.subscription.unsubscribe(); };
  }, [client]);
  async function account(e) {
    e.preventDefault(); if (busy || !client) return;
    const form = e.currentTarget, data = new FormData(form), action = e.nativeEvent.submitter?.value || 'in';
    setBusy(true);
    try { setMessage(await advertiserAccountAction(client,action,String(data.get('email') || ''),String(data.get('password') || ''))); form.reset(); }
    catch (error) { setMessage(safeAuthMessage(error)); }
    finally { setBusy(false); }
  }
  async function claim(e) {
    e.preventDefault(); if (!canRequestClaim(user, businesses, business, evidence, busy)) return;
    const form = e.currentTarget, fields = new FormData(form); setBusy(true);
    try {
      await verifiedAdvertiser(client);
      const { error } = await client.rpc('request_business_claim',{p_business:fields.get('business'),p_evidence:fields.get('evidence')});
      if (error) throw Error();
      setMessage('Claim pending Admin verification. Ownership has not been granted.'); form.reset(); setBusiness(''); setEvidence('');
      const { data, error: readError } = await client.from('business_ownership_claims').select('id,business_id,status').eq('claimant',user.id);
      if (!readError) setClaims(data ?? []);
    } catch { setMessage('Unable to submit claim. The business may already have an owner.'); }
    finally { setBusy(false); }
  }
  return <section className="business-form" aria-label="Advertiser account">
    {!user && <><h2>Advertiser account</h2><p>Sign in to submit a business or request ownership. Browsing is always public.</p></>}
    <form onSubmit={account}>
      {user ? <div className="pe-signed-in"><span role="status">SIGNED IN ✓</span><button type="submit" value="out" disabled={busy}>SIGN OUT</button></div> : <>
        <label className="form-field">Email<input name="email" type="email" autoComplete="email" required /></label>
        <label className="form-field">Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
        <button type="submit" value="in" disabled={busy}>Sign In</button>
        <button type="submit" value="create" disabled={busy}>Create Advertiser Account</button>
      </>}
    </form>
    {user && <form onSubmit={claim}><h3>CLAIM AN EXISTING BUSINESS</h3>
      <p>Select your business and tell us how we can verify that you represent it.</p>
      <BusinessSelector businesses={businesses} value={business} onChange={setBusiness} name="business" disabled={busy} />
      <label className="form-field">How can we verify that you represent this business?<textarea name="evidence" required minLength={10} maxLength={2000} value={evidence} onChange={e => setEvidence(e.target.value)} disabled={busy} placeholder="Example: I am the owner. You can verify me using the business phone number or email on file." /></label>
      <p className="pe-claim-warning">Do not include passwords or sensitive documents.</p>
      <button disabled={!canRequestClaim(user, businesses, business, evidence, busy)}>REQUEST VERIFICATION</button>
      {claims.map(c => <p key={c.id}>{businesses.find(b => b.id === c.business_id)?.business_name || 'Business claim'}: {c.status}</p>)}
    </form>}
    {message && <p role="status">{message}</p>}
  </section>;
}
