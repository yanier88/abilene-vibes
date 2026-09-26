import {useEffect, useRef, useState} from 'react';
import {adminGroups, adminDescriptions} from './adminDashboard.mjs';
import './AdminWorkspace.css';

const paths = {
 dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 events:'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4',
 gallery:'M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6 M15 8h.01',
 businesses:'M4 21V9l8-6 8 6v12 M9 21v-7h6v7 M2 21h20',
 claims:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
 marketplace:'M4 8h16l-1 13H5z M8 8V6a4 4 0 018 0v2',
 jobs:'M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3',
 rentals:'M2 11L12 2l10 9 M5 9v12h14V9 M9 21v-8h6v8',
 reviews:'M3 3h18v14H9l-6 4z M7 7h10 M7 11h7',
 payments:'M3 5h18v14H3z M3 10h18 M7 15h4',
 analytics:'M4 3v18h18 M8 17v-5 M13 17V8 M18 17V4',
};
function Icon({name}) {return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.dashboard}/></svg>;}

export default function AdminWorkspace({enabled, authorized, tabs, selected, onSelect, counts, summaries, status, refreshing = false, onRefresh, onLogout, onBack, children}) {
 const [open,setOpen]=useState(false);
 const menu=useRef(null), drawer=useRef(null), heading=useRef(null), content=useRef(null);
 const entries=[{id:'dashboard',label:'Dashboard'},...tabs];
 const selectedEntry=entries.find(x=>x.id===selected) || entries[0];
 const loading=['loading','signing-in',''].includes(status);
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const focusables=()=>[...drawer.current.querySelectorAll('button')].filter(b=>!b.disabled);
  focusables()[0]?.focus();
  function key(event){
   if(event.key==='Escape'){event.preventDefault();setOpen(false);menu.current?.focus();}
   if(event.key==='Tab'){const items=focusables(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }
  document.addEventListener('keydown',key);
  const wide=window.matchMedia('(min-width: 1000px)');const resize=()=>{if(wide.matches)setOpen(false);};wide.addEventListener('change',resize);
  return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',key);wide.removeEventListener('change',resize);};
 },[open]);
 useEffect(()=>{if(!authorized)setOpen(false);},[authorized]);
 if(!enabled)return children;
 const choose=id=>{onSelect(id);setOpen(false);requestAnimationFrame(()=>heading.current?.focus());};
 return <div className={`admin-workspace ${authorized?'is-authorized':'is-login'} ${open?'drawer-open':''}`} data-module={selected}>
  <a className="aw-skip" href="#admin-main-content">Skip to content</a>
  <header className="aw-header">
   {authorized&&<button ref={menu} type="button" className="aw-menu" aria-label="Open navigation" aria-expanded={open} aria-controls="admin-navigation" onClick={()=>setOpen(true)}>☰</button>}
   <div className="aw-brand"><span className="aw-brand-mark" aria-hidden="true">AV</span><div><strong>ABILENE VIBES</strong><span>Admin Panel <small>PRIVATE</small></span></div></div>
   <div className="aw-header-actions">
    {authorized&&<span className="aw-refresh-feedback" role="status" aria-live="polite">{refreshing?'Updating…':status==='refreshed'?'Updated just now':''}</span>}
    <button type="button" onClick={onBack} className="aw-back">Back to Lobby</button>
    {authorized&&<><button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing?'Refreshing…':'Refresh'}</button><button type="button" onClick={onLogout}>Sign Out</button></>}
   </div>
  </header>
  {authorized&&<>
   {open&&<button type="button" className="aw-overlay" tabIndex={-1} aria-label="Close navigation overlay" onClick={()=>{setOpen(false);menu.current?.focus();}}/>}
   <aside ref={drawer} id="admin-navigation" className="aw-sidebar" role={open?'dialog':undefined} aria-modal={open?true:undefined} aria-label="Admin navigation">
    <div className="aw-drawer-title"><strong>Workspace</strong><button type="button" aria-label="Close navigation" onClick={()=>{setOpen(false);menu.current?.focus();}}>✕</button></div>
    <nav aria-label="Admin modules">{adminGroups.map(group=><div className="aw-nav-group" key={group.label}><p>{group.label}</p>{group.ids.map(id=>{
     const entry=entries.find(e=>e.id===id);if(!entry)return null;
     return <button key={id} type="button" aria-current={selected===id?'page':undefined} onClick={()=>choose(id)}><Icon name={id}/><span>{entry.label}</span>{counts[id]!==undefined&&<span className="aw-count" aria-label={`${counts[id]} pending`}>{counts[id]}</span>}</button>;
    })}</div>)}</nav>
    <div className="aw-sidebar-footer"><span className="aw-status-dot"/>Authorized workspace<small>Abilene Vibes</small></div>
   </aside>
  </>}
  <div ref={content} className="aw-main" id="admin-main-content" inert={open?true:undefined}>
   {authorized&&<div className="aw-page-heading"><span className="aw-kicker">Workspace / {selectedEntry.label}</span><h1 ref={heading} tabIndex={-1}>{selectedEntry.label}</h1><p>{adminDescriptions[selected]}</p></div>}
   {authorized&&selected==='dashboard'&&<section className="aw-dashboard" aria-label="Dashboard overview">
    <div className="aw-overview"><div><span className="aw-kicker">Today’s workspace</span><h2>Keep Abilene moving.</h2><p>Review submissions and manage your community from one place.</p></div><Icon name="claims"/></div>
    <div className="aw-section-heading"><h2>Needs attention</h2><span>Pending review</span></div>
    <div className="aw-metrics">{['events','businesses','claims','gallery','marketplace','jobs','rentals','reviews'].map(id=><button className="aw-metric" key={id} type="button" onClick={()=>choose(id)}><span className="aw-metric-top"><Icon name={id}/><span>{entries.find(t=>t.id===id).label}</span></span><strong>{loading?'—':counts[id]}</strong><span className="aw-metric-bottom">{loading?'Loading data':'Awaiting review'}<span>Review →</span></span></button>)}</div>
    <div className="aw-section-heading"><h2>Published & active</h2><span>Current loaded data</span></div>
    <div className="aw-summary">{summaries.map(item=><button type="button" key={item.label} onClick={()=>choose(item.module)}><span>{item.label}</span><strong>{loading?'—':item.value}</strong><span>View →</span></button>)}</div>
   </section>}
   {children}
  </div>
 </div>;
}
