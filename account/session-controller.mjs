export const SESSION_ENDED = 'Your session has ended. Please sign in again.';
export const SESSION_UNAVAILABLE = 'We couldn’t check your session. Please reconnect and try again.';
const restoredIdentities = new WeakMap();
const restorations = new WeakMap();
const generations = new WeakMap();

export function invalidateSessionRestoration(auth) {
  restoredIdentities.delete(auth);
  restorations.delete(auth);
  generations.set(auth, (generations.get(auth) ?? 0) + 1);
}

// Share only this page's recent server verification between startup consumers.
// Never persist identity, tokens or permissions in a presentation cache.
export function restoredIdentity(auth) {
  const identity = restoredIdentities.get(auth);
  return identity && Date.now() - identity.at < 5000 ? identity.user : null;
}

// A one-use identity from this page's server verification, never a cached JWT user.
export function takeRestoredIdentity(auth) {
  const identity = restoredIdentities.get(auth);
  restoredIdentities.delete(auth);
  return identity && Date.now() - identity.at < 5000 ? identity.user : null;
}

function retryable(error) { return !error?.status || error.status === 429 || error.status >= 500; }
function unavailable(error) { return { state: 'session-unavailable', message: error?.status === 429 ? 'Too many session checks. Wait a moment, then try again.' : SESSION_UNAVAILABLE }; }

export async function restoreSession(auth, hadSession, clearStoredSession = () => {}) {
  let request = restorations.get(auth);
  if (!request) {
    const generation = generations.get(auth) ?? 0;
    request = restoreSessionOnce(auth, hadSession, generation);
    restorations.set(auth, request);
    const release = () => { if (restorations.get(auth) === request) restorations.delete(auth); };
    request.then(release, release);
  }
  const result = await request;
  if (result.state === 'session-ended') clearStoredSession();
  return result;
}

async function restoreSessionOnce(auth, hadSession, generation) {
  restoredIdentities.delete(auth);
  const changed = () => (generations.get(auth) ?? 0) !== generation;
  async function ended() {
    try { await auth.signOut({ scope: 'local' }); } catch { /* The rejected local session must still be cleared. */ }
    return { state: 'session-ended', message: SESSION_ENDED, email: '' };
  }
  try {
    const current = await auth.getSession();
    if (changed()) return unavailable();
    if (current.error) return retryable(current.error) ? unavailable(current.error) : ended();
    if (!current.data?.session) return hadSession ? ended() : { state: 'guest', message: '' };
    // Validate refresh-token revocation as well as refreshing an expired access JWT.
    // Cached session.user is never used as proof of identity or permissions.
    const renewed = await auth.refreshSession();
    if (changed()) return unavailable();
    if (renewed.error) return retryable(renewed.error) ? unavailable(renewed.error) : ended();
    if (!renewed.data?.session) return ended();
    const verified = await auth.getUser();
    if (changed()) return unavailable();
    if (verified.error) return retryable(verified.error) ? unavailable(verified.error) : ended();
    if (!verified.data?.user?.id || !verified.data.user.email || verified.data.user.is_anonymous) return ended();
    restoredIdentities.set(auth, { user: verified.data.user, at: Date.now() });
    return { state: 'signed-in', message: 'You’re signed in.', email: verified.data.user.email };
  } catch { return { state: 'session-unavailable', message: SESSION_UNAVAILABLE }; }
}
