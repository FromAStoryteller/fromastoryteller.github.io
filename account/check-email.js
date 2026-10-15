import { loadLocalAuthClient } from './local-auth-client.mjs';
import { readPendingEmail, savePendingEmail } from './pending-email.mjs';
import { resendVerification } from './signup-controller.mjs';

const form = document.querySelector('[data-resend-form]');
const input = form.querySelector('input');
const button = form.querySelector('button');
const status = document.querySelector('[data-auth-status]');
let auth;
let accountOrigin;
let pending = false;
let requestedAt = 0;
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!auth || pending || !form.reportValidity() || Date.now() - requestedAt < 60000) return;
  pending = true;
  updateButton();
  status.hidden = false;
  status.dataset.state = 'pending';
  status.textContent = 'Requesting another verification email…';
  const result = await resendVerification(auth, input.value, accountOrigin);
  status.dataset.state = result.state === 'error' ? 'error' : 'success';
  status.textContent = result.message;
  requestedAt = Date.now();
  savePendingEmail(input.value);
  pending = false;
  updateButton();
});
function updateButton() {
  const remaining = Math.max(0, Math.ceil((60000 - (Date.now() - requestedAt)) / 1000));
  button.disabled = !auth || pending || remaining > 0;
  button.textContent = pending ? 'Requesting email…' : remaining ? `Resend available in ${remaining}s` : 'Resend verification email';
}
try {
  const local = await loadLocalAuthClient();
  if (local?.signupEnabled) {
    auth = local.client.auth;
    accountOrigin = local.accountOrigin;
    const previous = readPendingEmail();
    if (previous) { input.value = previous.email; requestedAt = previous.requestedAt; }
    input.disabled = false;
    document.querySelector('[data-preview-note]').textContent = local.mode === 'development' ? 'Development test only — emails go to your inbox.' : 'Local test only — emails go to the local test inbox.';
    document.querySelector('[data-inbox-intro]').textContent = 'If this email address can be registered, you’ll receive a verification link. Open it to confirm your email before signing in. Already registered? You can sign in instead.';
    updateButton();
    setInterval(updateButton, 1000);
  }
} catch { status.hidden = false; status.dataset.state = 'error'; status.textContent = 'Local email requests are unavailable. Please try again.'; }
