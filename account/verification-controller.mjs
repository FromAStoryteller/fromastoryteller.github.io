export function consumeVerificationLink(url, removeCredentials) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.slice(1));
  removeCredentials();
  const hash = params.get('token_hash');
  if (parsed.search || params.getAll('token_hash').length !== 1 || params.getAll('type').length !== 1 || params.get('type') !== 'email' || !/^[A-Za-z0-9_-]{20,256}$/.test(hash ?? '')) return null;
  return hash;
}

export function createVerificationController(auth, tokenHash, onChange) {
  let busy = false;
  let finished = false;
  return async () => {
    if (busy || finished || !tokenHash) return;
    busy = true;
    onChange({ state: 'pending', message: 'Confirming your email…' });
    try {
      const { data, error } = await auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
      if (error) {
        const retryable = !error.status || error.status === 429 || error.status >= 500;
        finished = !retryable;
        return onChange({ state: 'error', retryable, message: retryable ? 'We couldn’t confirm your email right now. Please wait a moment and try again.' : 'This verification link has expired or is no longer valid. Request a new verification email.' });
      }
      if (!data?.user?.email_confirmed_at) return onChange({ state: 'error', retryable: true, message: 'We couldn’t confirm your email right now. Please try again.' });
      finished = true;
      tokenHash = null;
      onChange({ state: 'verified', message: 'Your email is verified. You can now sign in.' });
    } catch { onChange({ state: 'error', retryable: true, message: 'We couldn’t connect to account services. Please try again.' }); }
    finally { busy = false; }
  };
}
