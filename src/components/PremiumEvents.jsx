import BusinessSelector from './BusinessSelector.jsx';
import { selectableBusiness } from './businessSelector.mjs';
import { useEffect, useRef, useState } from "react";
import { eventEligibility, eventFields } from "./premiumEvents.mjs";
import { businessPostingStep, loadPostingContext } from "./premiumEventFlow.mjs";
import { advertiserAccountAction, safeAuthMessage } from "../auth/advertiserSession.mjs";
import AdvertiserAccount from "./AdvertiserAccount.jsx";
import "./PremiumEvents.css";
import PasswordField from "./PasswordField.jsx";
export function EventFields() {
  return (
    <div className="form-grid">
      {eventFields.map(([name, label, type, required]) => (
        <label className="form-field" key={name}>
          <span>{label}</span>
          {type === "textarea" ? (
            <textarea name={name} rows={3} required={required} />
          ) : (
            <input
              name={name}
              type={type}
              required={required}
              accept={type === "file" ? "image/*" : undefined}
            />
          )}
        </label>
      ))}
    </div>
  );
}
export default function PremiumEvents({ client, onUpgrade, onAddBusiness, optimizeImage }) {
  const [step, setStep] = useState("closed");
  const [options, setOptions] = useState([]), [business, setBusiness] = useState("");
  const [own, setOwn] = useState([]), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0), inFlight = useRef(false), key = useRef(null);
  const panel = useRef(null), trigger = useRef(null);
  const selected = options.find(b => b.business_id === business);
  const gate = eventEligibility(selected);

  useEffect(() => {
    if (step !== "closed") panel.current?.focus();
  }, [step]);
  useEffect(() => () => { revision.current++; }, []);
  useEffect(() => {
    if (step === "closed" || !client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        revision.current++; key.current = null;
        setOptions([]); setOwn([]); setBusiness(""); setStep("auth");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [client, step]);

  function close() {
    revision.current++; key.current = null; setStep("closed");
    setMessage(""); setOptions([]); setOwn([]); setBusiness("");
    trigger.current?.focus();
  }
  async function check() {
    const ticket = ++revision.current;
    setStep("loading"); setMessage(""); key.current = null;
    try {
      const context = await loadPostingContext(client);
      if (ticket !== revision.current) return;
      setOptions(context.options); setOwn(context.own);
      const id = context.options.length === 1 ? context.options[0].business_id : "";
      setBusiness(id);
      setStep(context.authenticated ? businessPostingStep(context.options, id) : "auth");
    } catch {
      if (ticket === revision.current) setStep("error");
    }
  }
  async function authenticate(e) {
    e.preventDefault(); if (inFlight.current) return;
    const form = e.currentTarget, fields = new FormData(form), ticket = revision.current;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      const response = await advertiserAccountAction(client, step === "create" ? "create" : "in",
        String(fields.get("email") || ""), String(fields.get("password") || ""));
      if (ticket !== revision.current) return;
      form.reset();
      if (response === "Advertiser signed in.") await check();
      else { setMessage(response); setStep("account-action"); }
    } catch (error) {
      if (ticket === revision.current) setMessage(safeAuthMessage(error));
    } finally { inFlight.current = false; setBusy(false); }
  }
  function choose(id) {
    if (!selectableBusiness(options, "post", id)) return;
    key.current = null; setBusiness(id); setMessage("");
    setStep(businessPostingStep(options, id));
  }
  async function submit(e) {
    e.preventDefault(); if (inFlight.current || !gate.allowed || step !== "form") return;
    inFlight.current = true; setBusy(true); setMessage("");
    const form = e.currentTarget, ticket = revision.current;
    try {
      const f = new FormData(form), image = f.get("eventImage"), fields = {};
      for (const [ui, db] of [
        ["title", "title"], ["place", "place"], ["description", "description"],
        ["eventAddress", "map_url"], ["websiteUrl", "website_url"], ["ticketUrl", "ticket_url"],
        ["eventDate", "event_date"], ["eventTime", "event_time"], ["endDate", "end_date"], ["endTime", "end_time"],
      ]) fields[db] = String(f.get(ui) || "").trim();
      fields.image_data = image?.size ? await optimizeImage(image) : "";
      if (ticket !== revision.current) return;
      key.current ??= crypto.randomUUID();
      const { error } = await client.rpc("submit_premium_event", { p_business: business, p_key: key.current, p_fields: fields });
      if (ticket !== revision.current) return;
      if (error) throw Error();
      key.current = null; form.reset(); setStep("success");
    } catch {
      if (ticket === revision.current) setMessage("Could not submit. Check your dates, Premium eligibility and available slots, then retry.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  const changeBusiness = options.length > 1 && ["premium", "full", "form", "unavailable"].includes(step);
  return <section className="premium-event-flow" aria-label="Post an event">
    {step === "closed" ? <button ref={trigger} className="pe-primary pe-entry" type="button" onClick={check}>POST AN EVENT</button> :
      <div className="pe-panel" ref={panel} tabIndex={-1} aria-label="Event posting" aria-busy={busy || step === "loading"}>
        <div className="pe-top"><span className="pe-eyebrow">BUSINESS EVENTS</span><button className="pe-close" type="button" disabled={busy} onClick={close} aria-label="Close event posting">Close</button></div>
        {step === "loading" && <><h2>POST AN EVENT</h2><p role="status">Checking your account…</p></>}
        {step === "auth" && <><h2>POST AN EVENT</h2><p>Sign in to your advertiser account to continue.</p><div className="pe-actions"><button className="pe-primary" onClick={() => setStep("in")}>SIGN IN</button><button className="pe-secondary" onClick={() => setStep("create")}>CREATE ACCOUNT</button></div></>}
        {["in", "create"].includes(step) && <><h2>{step === "in" ? "SIGN IN" : "CREATE ACCOUNT"}</h2><form onSubmit={authenticate}>
          <label>Email<input name="email" type="email" autoComplete="email" required disabled={busy} /></label>
          <PasswordField autoComplete={step === "create" ? "new-password" : "current-password"} disabled={busy} />
          <button className="pe-primary" disabled={busy}>{busy ? "Please wait…" : step === "in" ? "SIGN IN" : "CREATE ACCOUNT"}</button>
        </form><div className="pe-actions"><button className="pe-secondary" disabled={busy} onClick={() => { setMessage(""); setStep(step === "in" ? "create" : "in"); }}>{step === "in" ? "Create Account" : "Sign In"}</button><button className="pe-secondary" disabled={busy} onClick={() => { setMessage(""); setStep("auth"); }}>Back</button></div></>}
        {step === "account-action" && <><h2>ACCOUNT ACTION REQUIRED</h2><p>{message}</p><button className="pe-primary" onClick={() => { setMessage(""); setStep("in"); }}>SIGN IN</button><button className="pe-secondary" onClick={() => { setMessage(""); setStep("auth"); }}>BACK</button></>}
        {step === "none" && <><h2>NO LINKED BUSINESS</h2><p>You need a verified business before you can post an event.</p><div className="pe-actions"><button className="pe-primary" onClick={onAddBusiness}>ADD A BUSINESS</button><button className="pe-secondary" onClick={() => setStep("claim")}>CLAIM EXISTING BUSINESS</button></div></>}
        {step === "claim" && <><AdvertiserAccount client={client} /><button className="pe-secondary" onClick={check}>Back to event posting</button></>}
        {step === "choose" && <><h2>Choose your business</h2><BusinessSelector businesses={options} value={business} onChange={choose} mode="post" disabled={busy} /><p>🔒 Locked businesses cannot post events. Premium is required; active Premium businesses can use up to 3 slots.</p><button className="pe-secondary" onClick={onUpgrade}>VIEW PREMIUM PLANS</button></>}
        {step === "premium" && <><h2>PREMIUM FEATURE</h2><p>Posting events is available with a Premium promotion plan.</p><button className="pe-primary" onClick={onUpgrade}>VIEW PREMIUM PLANS</button></>}
        {step === "full" && <><h2>EVENT LIMIT REACHED</h2><p>You currently have 3 active or pending events. Wait until one ends or is no longer pending before submitting another.</p><button className="pe-primary" onClick={close}>DONE</button></>}
        {step === "form" && <><h2>POST AN EVENT</h2><p className="pe-detail">{selected.business_name} · {selected.occupied} of 3 event slots currently in use</p><form onSubmit={submit}><EventFields /><button className="pe-primary" disabled={busy}>{busy ? "Submitting…" : "SUBMIT FOR REVIEW"}</button></form></>}
        {step === "success" && <><h2>EVENT SUBMITTED</h2><p>Your event was sent for review. You'll be able to see its status after it has been reviewed.</p><button className="pe-primary" onClick={close}>DONE</button></>}
        {["error", "unavailable"].includes(step) && <><h2>UNABLE TO CONTINUE</h2><p>Event posting is unavailable right now. Please try again.</p><button className="pe-primary" onClick={check}>TRY AGAIN</button></>}
        {changeBusiness && <button className="pe-secondary" disabled={busy} onClick={() => { setMessage(""); setStep("choose"); key.current = null; }}>Choose another business</button>}
        {own.length > 0 && ["choose", "premium", "full", "form", "none"].includes(step) && <button className="pe-secondary" disabled={busy} onClick={() => setStep("submissions")}>View your submissions</button>}
        {step === "submissions" && <><h2>YOUR SUBMISSIONS</h2>{own.map(event => <article className="pe-submission" key={event.id}><h3>{event.title}</h3><p>{event.status}</p>{["pending", "approved"].includes(event.status) && <button className="pe-secondary" disabled={busy} onClick={async () => {
          if (inFlight.current) return;
          inFlight.current = true; setBusy(true); setMessage("");
          try { const { error } = await client.rpc("cancel_premium_event", { p_event: event.id }); if (error) throw Error(); await check(); }
          catch { setMessage("Could not cancel event. Please retry."); }
          finally { inFlight.current = false; setBusy(false); }
        }}>Cancel event</button>}</article>)}<button className="pe-secondary" disabled={busy} onClick={check}>Back</button></>}
        {message && step !== "account-action" && <p role="status" className="pe-message">{message}</p>}
      </div>}
  </section>;
}
