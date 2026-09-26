// Supabase validates identity and role; request generations protect every web-admin read.
export function createAdminWebSession(client, { onState, load, onLoading = () => {} }) {
  let revision = 0, disposed = false, session = null, candidateSession = null;
  let pending = null, pendingKind = null, key = null, signingOut = false;
  const emit = (state, value = null) => { if (!disposed) onState(state, value); };
  const valid = r => !disposed && r === revision;
  function clear(state) {
    revision++; session = null; candidateSession = null; key = null; pending = null; pendingKind = null;
    if (!disposed) onLoading(false);
    emit(state);
  }
  async function authorize(candidate) {
    const user = await client.auth.getUser(candidate.access_token);
    if (user.error || !user.data?.user || user.data.user.id !== candidate.user.id) return 'NOT_AUTHENTICATED';
    const admin = await client.rpc('is_service_admin');
    if (admin.error) throw new Error('Authorization unavailable');
    return admin.data === true ? 'AUTHORIZED_ADMIN' : 'ACCESS_DENIED';
  }
  function apply(candidate, refresh = false, fresh = false) {
    if (disposed || signingOut) return Promise.resolve(false);
    if (!candidate?.access_token || !candidate?.user?.id) { clear('NOT_AUTHENTICATED'); return Promise.resolve(false); }
    if (candidate.access_token === key && pending && !fresh) return pending;
    if (candidate.access_token === key && session && !refresh) return Promise.resolve(true);
    const sameAuthorizedSession = session?.access_token === candidate.access_token;
    const r = ++revision;
    candidateSession = candidate; key = candidate.access_token;
    if (!sameAuthorizedSession) { session = null; emit('AUTHENTICATING'); }
    onLoading(true);
    pendingKind = refresh ? 'refresh' : 'restore';
    const work = (async () => {
      try {
        const state = await authorize(candidate);
        if (!valid(r)) return false;
        if (state !== 'AUTHORIZED_ADMIN') { clear(state); return false; }
        session = candidate; emit('AUTHORIZED_ADMIN', session);
      } catch {
        if (valid(r)) clear('NETWORK_ERROR');
        return false;
      }
      try {
        const loaded = await load(candidate, refresh, () => valid(r));
        if (!valid(r)) return false;
        if (loaded === false) emit('DATA_ERROR', session);
        return loaded !== false;
      } catch {
        if (valid(r)) emit('DATA_ERROR', session);
        return false;
      } finally {
        if (valid(r)) { pending = null; pendingKind = null; onLoading(false); }
      }
    })();
    pending = work;
    return work;
  }
  async function restore() {
    const r = revision;
    try {
      const { data, error } = await client.auth.getSession();
      if (!valid(r)) return false;
      if (error) { clear('NOT_AUTHENTICATED'); return false; }
      return apply(data.session);
    } catch { if (valid(r)) clear('NETWORK_ERROR'); return false; }
  }
  return {
    apply, restore,
    refresh() {
      if (pendingKind === 'refresh' && pending) return pending;
      return candidateSession ? apply(candidateSession, true, true) : restore();
    },
    refreshAfterMutation() {
      // A mutation/realtime invalidation starts a new generation immediately.
      // Older reads may finish, but their isCurrent guard cannot publish state.
      return candidateSession ? apply(candidateSession, true, true) : Promise.resolve(false);
    },
    async login(credentials) {
      clear('AUTHENTICATING');
      const r = revision;
      try {
        const { data, error } = await client.auth.signInWithPassword(credentials);
        if (!valid(r)) return false;
        if (error) { clear('LOGIN_ERROR'); return false; }
        return apply(data.session);
      } catch { if (valid(r)) clear('NETWORK_ERROR'); return false; }
    },
    async logout() {
      signingOut = true; clear('NOT_AUTHENTICATED');
      try {
        const result = await client.auth.signOut();
        if (result?.error) emit('NETWORK_ERROR');
      } catch { emit('NETWORK_ERROR'); }
      finally { signingOut = false; }
    },
    dispose() { disposed = true; revision++; session = null; candidateSession = null; },
  };
}
