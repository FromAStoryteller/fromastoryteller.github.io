import { LOCAL_ACCOUNT_ORIGIN } from './auth-settings.mjs';
import { passwordChecks } from './password-policy.mjs';

export const RECOVERY_MESSAGE = 'If an account exists for that email, we’ll send a recovery link. Check your inbox and spam or junk folder.';
export async function requestRecovery(auth, email) {
  try {
    const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: LOCAL_ACCOUNT_ORIGIN + '/account/reset-password/' });
    if (error && (error.status === 429 || !error.status || error.status >= 500)) return { state: 'error', message: error.status === 429 ? 'Too many requests. Wait a few minutes, then try again.' : 'We couldn’t connect to account services. Please try again.' };
    // Never reveal whether an address belongs to an account.
    return { state: 'requested', message: RECOVERY_MESSAGE };
  } catch { return { state: 'error', message: 'We couldn’t connect to account services. Please try again.' }; }
}

export function consumeRecoveryLink(url, scrub) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.slice(1));
  scrub();
  if (parsed.search || params.getAll('token_hash').length !== 1 || params.getAll('type').length !== 1 || params.get('type') !== 'recovery') return null;
  const hash = params.get('token_hash');
  return /^[A-Za-z0-9_-]{20,256}$/.test(hash ?? '') ? hash : null;
}

export function createRecoveryController(auth, tokenHash, onChange) {
  let busy = false;
  let verifiedUser = null;
  let finished = false;
  return {
    async verify() {
      if (busy || finished || verifiedUser || !tokenHash) return;
      busy = true;
      onChange({ state: 'checking', message: 'Checking your recovery link…' });
      try {
        const { data, error } = await auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        if (error || !data?.session || !data?.user?.id) {
          const retryable = !!error && (!error.status || error.status === 429 || error.status >= 500);
          finished = !retryable;
          return onChange({ state: 'invalid', retryable, message: retryable ? 'We couldn’t check your link right now. Wait a moment and try again.' : 'This recovery link has expired or is no longer valid. Request a new recovery email.' });
        }
        verifiedUser = data.user.id;
        tokenHash = null;
        onChange({ state: 'ready', message: 'Recovery link confirmed. Choose your new password below. Keep this page open until you finish.' });
      } catch { onChange({ state: 'invalid', retryable: true, message: 'We couldn’t connect to account services. Please try again.' }); }
      finally { busy = false; }
    },
    async save(password, confirmation) {
      if (busy || finished || !verifiedUser) return;
      if (!Object.values(passwordChecks(password, confirmation)).every(Boolean)) return onChange({ state: 'password-error', message: 'Make sure your password meets every requirement and both entries match.' });
      busy = true;
      onChange({ state: 'saving', message: 'Saving your new password…' });
      try {
        const checked = await auth.getUser();
        if (checked.error || checked.data?.user?.id !== verifiedUser) {
          finished = true;
          return onChange({ state: 'invalid', message: 'Your recovery session has ended. Request a new recovery email.' });
        }
        const { data, error } = await auth.updateUser({ password });
        if (error || data?.user?.id !== verifiedUser) return onChange({ state: 'password-error', message: error?.code === 'same_password' ? 'Choose a password different from your current password.' : error?.code === 'weak_password' ? 'Your password does not meet the requirements below.' : 'We couldn’t save your password. Try again, or request a new recovery email.' });
        finished = true;
        verifiedUser = null;
        const signedOut = await auth.signOut({ scope: 'global' }).catch(() => ({ error: true }));
        onChange({ state: 'saved', message: signedOut.error ? 'Your password was changed. We couldn’t confirm sign-out of every session. Sign in with your new password and review your account access.' : 'Your password was changed. Sign in with your new password.' });
      } catch { onChange({ state: 'password-error', message: 'We couldn’t confirm the change. Try signing in with your new password before requesting another recovery email.' }); }
      finally { busy = false; }
    },
  };
}
