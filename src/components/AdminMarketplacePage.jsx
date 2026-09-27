import { useEffect, useState } from 'react';
import { readMarketplaceImages, marketplacePage } from './adminMarketplace.mjs';

// Images are private module data: never request them outside the authorized, active module.
export default function AdminMarketplacePage({ listings, active, client, enabled, children }) {
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [images, setImages] = useState({});
  const [status, setStatus] = useState('loading');
  const current = marketplacePage(listings, page);
  const ids = current.rows.map(row => row.id).join(',');
  useEffect(() => {
    if (!enabled || !active) return;
    let currentRequest = true;
    setStatus('loading');
    // Clear the previous page so image memory remains bounded to one batch.
    setImages({});
    readMarketplaceImages(client, current.rows.map(row => row.id)).then(result => {
      if (!currentRequest) return;
      setImages(result.images);
      setStatus(result.ok ? 'ready' : 'error');
    });
    return () => { currentRequest = false; };
  }, [enabled, active, client, ids, listings, attempt]);
  if (!enabled) return children(listings, () => true);
  if (!active) return null;
  return <>
    {status === 'loading' && <p role="status">Loading Marketplace photos...</p>}
    {status === 'error' && <p role="status">Some Marketplace photos could not load. Listings remain available. <button type="button" className="directory-link" onClick={() => setAttempt(value => value + 1)}>Retry photos</button></p>}
    {children(current.rows.map(row => ({ ...row, image_data: images[row.id] ?? '' })), row => status === 'ready' && Object.hasOwn(images, row.id))}
    {current.pages > 1 && <nav aria-label="Marketplace pages" className="directory-actions">
      <button type="button" className="directory-link" disabled={current.page === 0} onClick={() => setPage(current.page - 1)}>Previous page</button>
      <span role="status">Page {current.page + 1} of {current.pages}</span>
      <button type="button" className="directory-link" disabled={current.page + 1 >= current.pages} onClick={() => setPage(current.page + 1)}>Next page</button>
    </nav>}
  </>;
}
