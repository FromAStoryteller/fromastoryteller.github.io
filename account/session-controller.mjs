export const SESSION_ENDED = 'Your session has ended. Please sign in again.';
export const SESSION_UNAVAILABLE = 'We couldn’t check your session. Please reconnect and try again.';

function retryable(error) { return !error?.status || error.status === 429 || error.status >= 500; }
function unavailable(error) { return { state: 'session-unavailable', message: error?.status === 429 ? 'Too many session checks. Wait a moment, then try again.' : SESSION_UNAVAILABLE }; }

export async function restoreSession(auth, hadSession, clearStoredSession = () => {}) {
  async function ended() {
    try { await auth.signOut({ scope: 'local' }); } catch { /* The rejected local session must still be cleared. */ }
    clearStoredSession();
    return { state: 'session-ended', message: SESSION_ENDED, email: '' };
  }
  try {
    const current = await auth.getSession();
    if (current.error) return retryable(current.error) ? unavailable(current.error) : ended();
    if (!current.data?.session) return hadSession ? ended() : { state: 'guest', message: '' };
    // Validate refresh-token revocation as well as refreshing an expired access JWT.
    // Cached session.user is never used as proof of identity or permissions.
    const renewed = await auth.refreshSession();
    if (renewed.error) return retryable(renewed.error) ? unavailable(renewed.error) : ended();
    if (!renewed.data?.session) return ended();
    const verified = await auth.getUser();
    if (verified.error) return retryable(verified.error) ? unavailable(verified.error) : ended();
    if (!verified.data?.user?.id || !verified.data.user.email || verified.data.user.is_anonymous) return ended();
    return { state: 'signed-in', message: 'You’re signed in.', email: verified.data.user.email };
  } catch { return { state: 'session-unavailable', message: SESSION_UNAVAILABLE }; }
}
