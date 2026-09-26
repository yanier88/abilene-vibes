import { useEffect, useId, useRef, useState } from 'react';
import { selectorRows, selectableBusiness } from './businessSelector.mjs';

export default function BusinessSelector({ businesses, value, onChange, mode = 'claim', disabled = false, name }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const id = useId(), trigger = useRef(null), searchInput = useRef(null);
  const rows = selectorRows(businesses, mode, search);
  const selected = selectorRows(businesses, mode).find(b => b.id === value);
  useEffect(() => { if (open) searchInput.current?.focus(); }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  function close() { setOpen(false); setSearch(''); trigger.current?.focus(); }
  return <div className="pe-business-selector">
    <span id={`${id}-label`} className="pe-business-label">Business</span>
    {name && <input type="hidden" name={name} value={selected && !selected.locked ? selected.id : ''} />}
    <button ref={trigger} type="button" className="pe-business-trigger" disabled={disabled}
      aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => open ? close() : setOpen(true)}>
      <span id={`${id}-value`}>{selected?.name || 'Select business'}</span><span aria-hidden="true">▾</span>
    </button>
    {open && <div id={id} role="dialog" aria-labelledby={`${id}-title`} className="pe-business-menu"
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <h3 id={`${id}-title`}>SELECT YOUR BUSINESS</h3>
      <div className="pe-business-search"><input ref={searchInput} type="search" aria-label="Search businesses" placeholder="Search businesses..."
        value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} />
        {search && <button type="button" onClick={() => { setSearch(''); searchInput.current?.focus(); }}>Clear search</button>}
      </div>
      <div className="pe-business-list">
        {!rows.length && <p role="status">No results</p>}
        {rows.map(b => <button key={b.id} type="button" className="pe-business-row" aria-pressed={value === b.id}
          disabled={b.locked} onClick={() => {
            if (disabled || !selectableBusiness(businesses, mode, b.id)) return;
            onChange(b.id); close();
          }}>
          <span><span className="pe-business-name">{b.name}</span>{b.locked && <span className="pe-business-lock">🔒 {b.reason}</span>}</span>
          {value === b.id && <span className="pe-business-check" aria-label="Selected">✓</span>}
        </button>)}
      </div>
      <button type="button" className="pe-business-cancel" onClick={close}>Cancel</button>
    </div>}
  </div>;
}
