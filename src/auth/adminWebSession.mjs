// Web-admin orchestration only. Authorization remains enforced by Supabase/RLS.
export function createAdminWebSession(client, { onState, load }) {
  let revision = 0, disposed = false, session = null, pending = null, key = null;
  const emit = (state, value = null) => { if (!disposed) onState(state, value); };
  const valid = (r) => !disposed && r === revision;
  function clear(state) {
    revision++; session = null; key = null; pending = null; emit(state);
  }
  async function authorize(candidate) {
    const user = await client.auth.getUser(candidate.access_token);
    if (user.error || !user.data?.user || user.data.user.id !== candidate.user.id) return 'NOT_AUTHENTICATED';
    const admin = await client.rpc('is_service_admin');
    if (admin.error) throw new Error('Authorization unavailable');
    return admin.data === true ? 'AUTHORIZED_ADMIN' : 'ACCESS_DENIED';
  }
  function apply(candidate, refresh = false) {
    if (disposed) return Promise.resolve();
    if (!candidate) { clear('NOT_AUTHENTICATED'); return Promise.resolve(); }
    if (candidate.access_token === key && pending) return pending;
    if (candidate.access_token === key && session && !refresh) return Promise.resolve();
    const r = ++revision;
    key = candidate.access_token; session = null; emit('AUTHENTICATING');
    const work = (async () => {
      try {
        const state = await authorize(candidate);
        if (!valid(r)) return;
        if (state !== 'AUTHORIZED_ADMIN') { clear(state); return; }
        session = candidate; emit('AUTHORIZED_ADMIN', session);
        await load(session, refresh, () => valid(r));
      } catch {
        if (valid(r)) clear('NETWORK_ERROR');
      } finally { if (valid(r)) pending = null; }
    })();
    pending = work;
    return work;
  }
  async function restore() {
    const r = revision;
    try {
      const { data, error } = await client.auth.getSession();
      if (!valid(r)) return;
      if (error) { clear('NOT_AUTHENTICATED'); return; }
      return apply(data.session);
    } catch { if (valid(r)) clear('NETWORK_ERROR'); }
  }
  return {
    apply, restore,
    refresh: () => session ? apply(session, true) : restore(),
    async refreshAfterMutation() {
      // A read started before the mutation may contain stale rows. Wait for it,
      // then reauthorize and read again; never reuse that in-flight snapshot.
      const r = revision;
      if (pending) await pending;
      if (!valid(r) || !session) return;
      return apply(session, true);
    },
    async login(credentials) {
      clear('AUTHENTICATING');
      const r = revision;
      try {
        const { data, error } = await client.auth.signInWithPassword(credentials);
        if (!valid(r)) return;
        if (error) { clear('LOGIN_ERROR'); return; }
        await apply(data.session);
      } catch { if (valid(r)) clear('NETWORK_ERROR'); }
    },
    async logout() {
      clear('NOT_AUTHENTICATED');
      try { await client.auth.signOut(); } catch { emit('NETWORK_ERROR'); }
    },
    dispose() { disposed = true; revision++; session = null; },
  };
}
