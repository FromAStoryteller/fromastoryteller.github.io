export function signInError(error) {
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') return 'Too many attempts. Wait a few minutes, then try again.';
  if (!error?.status || error.status >= 500) return 'We couldn’t connect to account services. Please try again.';
  return 'We couldn’t sign you in. Check your email and password, and make sure you’ve verified your email.';
}

export function createSignInController(auth, onChange) {
  let busy = false;
  const emit = (state, message, email = '') => onChange({ state, message, email });
  return {
    async signIn(email, password) {
      if (busy) return;
      busy = true;
      emit('pending', 'Signing you in…');
      try {
        const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) return emit('error', signInError(error));
        if (!data?.session || !data?.user) return emit('error', signInError({}));
        emit('signed-in', 'You’re signed in.', data.user.email ?? '');
      } catch { emit('error', signInError({})); }
      finally { busy = false; }
    },
    async signOut() {
      if (busy) return;
      busy = true;
      emit('signing-out', 'Signing you out…');
      try {
        const { error } = await auth.signOut({ scope: 'local' });
        if (error) return emit('sign-out-error', 'We couldn’t finish signing you out. Please try again.');
        emit('signed-out', 'You’ve signed out.');
      } catch { emit('sign-out-error', 'We couldn’t finish signing you out. Please try again.'); }
      finally { busy = false; }
    },
    sessionEnded() { emit('signed-out', 'Your session has ended. Please sign in again.'); },
  };
}
