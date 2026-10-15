import { loadLocalAuthClient } from './local-auth-client.mjs';
import { consumeVerificationLink, createVerificationController } from './verification-controller.mjs';
import { clearPendingEmail } from './pending-email.mjs';

// Remove credentials before any network request, regardless of validity or environment.
const tokenHash = consumeVerificationLink(location.href, () => history.replaceState(null, '', '/account/verify-email/'));
const button = document.querySelector('[data-confirm-email]');
const status = document.querySelector('[data-auth-status]');
const intro = document.querySelector('[data-verification-intro]');
const help = document.querySelector('[data-verification-help]');
let verify;
button.addEventListener('click', () => verify?.());
function render({ state, message, retryable }) {
  status.hidden = false;
  status.textContent = message;
  status.dataset.state = state === 'error' ? 'error' : state === 'verified' ? 'success' : 'pending';
  button.disabled = state === 'pending';
  button.hidden = state === 'verified' || (state === 'error' && !retryable);
  button.textContent = state === 'pending' ? 'Confirming email…' : 'Confirm email';
  const terminal = state === 'verified' || (state === 'error' && !retryable);
  intro.hidden = terminal;
  document.querySelector('[data-verification-expiry]').hidden = terminal;
  if (state === 'verified') {
    clearPendingEmail();
    help.textContent = 'Ready to continue?';
    const next = document.querySelector('[data-verification-next]');
    next.textContent = 'Sign in';
    next.href = '/account/sign-in/';
    next.focus();
  }
}
try {
  const local = await loadLocalAuthClient();
  if (local?.signupEnabled) {
    document.querySelector('[data-preview-note]').textContent = local.mode === 'development' ? 'Development test only — this confirms your FAS DEV test account.' : 'Local test only — this confirms a local FAS test account.';
    intro.textContent = tokenHash ? 'Select Confirm email to finish verifying your email address.' : 'Open the verification link from your email to continue. If you need a new link, request another email below.';
    if (tokenHash) {
      verify = createVerificationController(local.client.auth, tokenHash, render);
      button.hidden = false;
      button.disabled = false;
    }
  }
} catch { render({ state: 'error', retryable: false, message: 'Local email verification is unavailable. Please reopen your email link after restarting the local preview.' }); }
