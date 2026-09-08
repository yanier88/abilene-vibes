import { useEffect, useRef, useState } from 'react';
import { getAbileneStoreKit } from './abileneStoreKit.js';
import { LOCAL_PRODUCTS, verifiedLocalGate, safeEvent, mergeKnown, localConfirmation, markExplicitFinish } from './appleIAPLocalModel.mjs';

export default function AppleIAPLocalTest() {
  const [gate, setGate] = useState('Verifying native Xcode environment…');
  const [ready, setReady] = useState(false), [closed, setClosed] = useState(false);
  const [products, setProducts] = useState([]), [known, setKnown] = useState({});
  const [selected, setSelected] = useState(''), [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const bridge = useRef(null), receipts = useRef(new Map()), token = useRef(null);
  const addLog = (label, value) => setLog(old => [{ label, value }, ...old].slice(0, 60));
  const absorb = (events, source) => {
    for (const event of events) {
      const confirmation = localConfirmation(event);
      if (confirmation) receipts.current.set(confirmation.transactionId, confirmation);
    }
    setKnown(old => mergeKnown(old, events, source));
    addLog(source, events.map(safeEvent));
  };
  useEffect(() => {
    if (closed) return;
    let cancelled = false, listener;
    const native = getAbileneStoreKit();
    bridge.current = native;
    (async () => {
      try {
        const proof = await native.getVerifiedAppTransaction();
        if (cancelled) return;
        if (!verifiedLocalGate(proof)) { setGate('BLOCKED: Debug simulator + local scheme + verified Xcode required. No fallback.'); return; }
        token.current = crypto.randomUUID(); // Test only: never persisted or sent to Supabase.
        listener = await native.addListener('transactionUpdate', event => { if (!cancelled) absorb([event], 'transactionUpdate'); });
        if (cancelled) { await listener.remove(); return; }
        await native.startTransactionUpdates();
        if (cancelled) { await native.stopTransactionUpdates(); return; }
        setGate('Verified Xcode • native local test enabled • TEST UUID in memory');
        setReady(true);
      } catch { if (!cancelled) setGate('BLOCKED: native environment verification failed.'); }
    })();
    return () => {
      cancelled = true;
      void listener?.remove();
      void native.stopTransactionUpdates();
      receipts.current.clear();
      token.current = null;
    };
  // The screen is mounted once, outside StrictMode; exit performs the same cleanup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed]);
  const action = async (label, task) => {
    if (!ready || busy || closed) return;
    setBusy(true);
    try { await task(); } catch { addLog(label, 'ERROR — operation rejected; no automatic retry or finish.'); }
    finally { setBusy(false); }
  };
  const buy = id => action('purchase', async () => {
    const result = await bridge.current.purchase({ productId: id, appAccountToken: token.current });
    absorb([result], 'purchase');
    if (result.status === 'verified') setSelected(result.proof.transactionId);
  });
  const button = { padding: '10px', background: '#244366', color: 'white', border: '1px solid #7f9bb6', borderRadius: 6, fontSize: 14 };
  return <main style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#101923', color: 'white', padding: 'max(18px, env(safe-area-inset-top)) 14px max(20px, env(safe-area-inset-bottom))', boxSizing: 'border-box', font: '14px system-ui', textAlign: 'left' }}>
    <h1 style={{ fontSize: 22, color: 'white' }}>Apple IAP Local Test</h1>
    <p>{closed ? 'Closed — listener stopped' : gate}</p>
    <p>Xcode only. No backend, promotions or real payments. Finish is always explicit.</p>
    {ready && !closed && <fieldset disabled={!ready || busy || closed} style={{ border: 0, padding: 0, display: 'grid', gap: 8 }}>
      <button style={button} onClick={() => action('products', async () => { const r = await bridge.current.getProducts({ productIds: LOCAL_PRODUCTS }); setProducts(r.products); addLog('products loaded', r.products.map(p => ({ id: p.id, displayPrice: p.displayPrice, group: p.subscriptionGroupIdentifier }))); })}>Load Products</button>
      {LOCAL_PRODUCTS.map((id, i) => <button style={button} key={id} disabled={!products.some(p => p.id === id)} onClick={() => buy(id)}>Buy {['Slot01 Featured', 'Slot01 Premium', 'Slot02 Featured'][i]} {products.find(p => p.id === id)?.displayPrice ?? ''}</button>)}
      <button style={button} onClick={() => action('entitlements', async () => absorb((await bridge.current.getCurrentEntitlements()).transactions, 'entitlements'))}>Refresh Entitlements</button>
      <button style={button} onClick={() => action('unfinished', async () => absorb((await bridge.current.getUnfinishedTransactions()).transactions, 'unfinished'))}>Show Unfinished</button>
      <button style={button} onClick={() => action('sync', async () => { const r = await bridge.current.syncPurchases(); absorb(r.entitlements, 'sync entitlements'); absorb(r.unfinished, 'sync unfinished'); })}>Restore / Sync</button>
      <label>Selected transaction <select aria-label="Selected transaction" value={selected} onChange={e => setSelected(e.target.value)} style={{ maxWidth: '100%' }}><option value="">Select…</option>{Object.values(known).map(t => <option key={t.transactionId} value={t.transactionId}>{t.transactionId} · {t.productId.split('.').slice(-3, -1).join(' ')}</option>)}</select></label>
      <button style={button} disabled={!receipts.current.has(selected) || known[selected]?.delivery.startsWith('explicitly')} onClick={() => action('finish', async () => {
        const result = await bridge.current.finishTransaction({ transactionId: selected, deliveryConfirmation: receipts.current.get(selected) });
        setKnown(old => markExplicitFinish(old, result)); receipts.current.delete(selected); addLog('EXPLICIT FINISH', result);
      })}>Finish Selected — synthetic TEST delivery</button>
    </fieldset>}
    {ready && !closed && <button style={{ ...button, marginTop: 8 }} disabled={busy || closed} onClick={() => { setReady(false); setClosed(true); }}>Exit Test / Stop Listener</button>}
    <h2 style={{ fontSize: 17, color: 'white' }}>Known transactions — retained across empty queries</h2>
    <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(Object.values(known), null, 2)}</pre>
    <h2 style={{ fontSize: 17, color: 'white' }}>Read-only diagnostics (no JWS / receipts)</h2>
    {log.map((entry, index) => <section key={index}><strong>{entry.label}</strong><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(entry.value, null, 2)}</pre></section>)}
  </main>;
}
