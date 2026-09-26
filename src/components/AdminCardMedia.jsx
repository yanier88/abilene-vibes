import {useState} from 'react';

// The public Jobs loader maps image_data directly to image; no new storage contract.
export default function AdminCardMedia({src, alt = ''}) {
  const [failedSource, setFailedSource] = useState(null);
  if (!src || failedSource === src) return null;
  return <img className="aw-card-media" src={src} alt={alt} loading="lazy" onError={() => setFailedSource(src)} />;
}
