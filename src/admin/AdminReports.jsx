import {useCallback,useEffect,useRef,useState} from 'react';
import {reasons,rpc} from '../ugc/reportContract.mjs';
import './AdminReports.css';
export function AdminReports({client,onReview}){
 const [rows,setRows]=useState([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);const lock=useRef(false);
 const load=useCallback(async()=>{try{setRows(await rpc(client,'ugc_admin_reports'));setMessage('');}catch(e){setMessage(e.message);}},[client]);useEffect(()=>{load();},[load]);
 async function resolve(id,status){if(lock.current)return;lock.current=true;setBusy(true);try{await rpc(client,'ugc_admin_resolve',{p_report:id,p_status:status});await load();}catch(e){setMessage(e.message);}finally{lock.current=false;setBusy(false);}}
 return <section className="ugc-admin"><h2>Content reports</h2><p>Review using the existing moderation controls. Resolving a report does not approve, hide or delete content.</p><button type="button" onClick={load} disabled={busy}>Refresh reports</button>{rows.map(r=><article key={r.id}><h3>{r.module} · {reasons[r.reason]}</h3><p>Content reference: {r.content_id}</p><p>{r.note}</p><p>{new Date(r.created_at).toLocaleString()} · {r.status}</p><button type="button" onClick={()=>onReview(r.module,r.content_id)}>Review content</button>{r.status==='open'&&<><button disabled={busy} onClick={()=>resolve(r.id,'resolved')}>Resolve report</button><button disabled={busy} onClick={()=>resolve(r.id,'dismissed')}>Dismiss report</button></>}</article>)}{!rows.length&&!message&&<p>No reports.</p>}{message&&<p role="status">{message}</p>}</section>;
}
