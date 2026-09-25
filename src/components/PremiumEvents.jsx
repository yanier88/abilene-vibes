import { useEffect, useRef, useState } from "react";
import { eventEligibility, eventFields } from "./premiumEvents.mjs";
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
export default function PremiumEvents({ client, onUpgrade, optimizeImage }) {
  const [options, setOptions] = useState([]),
    [business, setBusiness] = useState(""),
    [session, setSession] = useState(null),
    [own, setOwn] = useState([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false);
  const key = useRef(null),
    inFlight = useRef(false),
    revision = useRef(0);
  async function load(s) {
    const r = ++revision.current;
    setSession(s);
    setOptions([]);
    setOwn([]);
    setOpen(false);
    if (!s || !client) return;
    try {
      const [a, b] = await Promise.all([
        client.rpc("premium_event_options"),
        client
          .from("event_submissions")
          .select("id,title,status")
          .eq("submitted_by", s.user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (r !== revision.current) return;
      if (a.error || b.error) throw Error();
      setOptions(a.data ?? []);
      setBusiness((old) =>
        (a.data ?? []).some((x) => x.business_id === old)
          ? old
          : (a.data?.[0]?.business_id ?? ""),
      );
      setOwn(b.data ?? []);
    } catch {
      if (r === revision.current)
        setMessage("Event eligibility is unavailable. Please retry.");
    }
  }
  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth
      .getSession()
      .then(({ data }) => {
        if (active) void load(data.session);
      })
      .catch(() => {
        if (active) setMessage("Unable to check your session.");
      });
    const { data } = client.auth.onAuthStateChange((_e, s) => {
      setTimeout(() => {
        if (active) void load(s);
      }, 0);
    });
    return () => {
      active = false;
      revision.current++;
      data.subscription.unsubscribe();
    };
  }, [client]);
  const selected = options.find((x) => x.business_id === business),
    gate = eventEligibility(selected);
  async function submit(e) {
    e.preventDefault();
    if (inFlight.current || !gate.allowed) return;
    inFlight.current = true;
    setBusy(true);
    const form = e.currentTarget;
    try {
      const f = new FormData(form),
        image = f.get("eventImage");
      const fields = {};
      for (const [ui, db] of [
        ["title", "title"],
        ["place", "place"],
        ["description", "description"],
        ["eventAddress", "map_url"],
        ["websiteUrl", "website_url"],
        ["ticketUrl", "ticket_url"],
        ["eventDate", "event_date"],
        ["eventTime", "event_time"],
        ["endDate", "end_date"],
        ["endTime", "end_time"],
      ])
        fields[db] = String(f.get(ui) || "").trim();
      fields.image_data = image?.size ? await optimizeImage(image) : "";
      key.current ??= crypto.randomUUID();
      const r = await client.rpc("submit_premium_event", {
        p_business: business,
        p_key: key.current,
        p_fields: fields,
      });
      if (r.error) throw Error();
      key.current = null;
      form.reset();
      setMessage(
        "Event submitted for admin review. It is not public until approved.",
      );
      await load(session);
    } catch {
      setMessage(
        "Could not submit. Check the dates, Premium eligibility and available slots, then retry.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="admin-section" aria-label="Post a business event">
      <h2>Post Event</h2>
      {!session && <p>Sign in with your advertiser account above to post an event.</p>}
      {session && options.length > 0 && (
        <label className="form-field">
          Business
          <select
            value={business}
            disabled={busy}
            onChange={(e) => {
              setBusiness(e.target.value);
              setOpen(false);
              key.current = null;
            }}
          >
            {options.map((b) => (
              <option key={b.business_id} value={b.business_id}>
                {b.business_name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!gate.premium && (
        <>
          <h3>Premium Feature</h3>
          <p>Posting events is available with a Premium promotion plan.</p>
          <button type="button" onClick={onUpgrade}>
            View promotion plans
          </button>
        </>
      )}
      {gate.full && (
        <p>
          You currently have 3 active or pending events. Wait until one ends or
          is no longer pending before submitting another.
        </p>
      )}
      <button
        type="button"
        disabled={!gate.allowed || busy}
        onClick={() => {
          setOpen(true);
          key.current = null;
        }}
      >
        Post Event
      </button>
      {open && gate.allowed && (
        <form className="gallery-form" onSubmit={submit}>
          <EventFields />
          <button type="submit" disabled={busy}>
            {busy ? "Submitting..." : "Submit for review"}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {session && (
        <button type="button" disabled={busy} onClick={() => load(session)}>
          Refresh event eligibility
        </button>
      )}
      {own.map((e) => (
        <article key={e.id}>
          <h3>{e.title}</h3>
          <p>{e.status}</p>
          {["pending", "approved"].includes(e.status) && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await client.rpc("cancel_premium_event", {
                    p_event: e.id,
                  });
                  if (r.error) throw Error();
                  await load(session);
                } catch {
                  setMessage("Could not cancel event. Please retry.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cancel event
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
