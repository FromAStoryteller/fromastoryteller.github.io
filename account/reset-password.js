import { loadLocalAuthConfig } from './auth-settings.mjs';
import { consumeRecoveryLink, createRecoveryController } from './recovery-controller.mjs';

const hash = consumeRecoveryLink(location.href, () => history.replaceState(null, '', '/account/reset-password/'));
const form = document.querySelector('[data-reset-form]');
const fieldset = form.querySelector('fieldset');
const status = document.querySelector('[data-auth-status]');
const verify = document.querySelector('[data-confirm-recovery]');
let controller;
function render({ state, message, retryable }) {
  status.hidden = false;
  status.textContent = message;
  status.dataset.state = ['invalid', 'password-error'].includes(state) ? 'error' : ['saved', 'ready'].includes(state) ? 'success' : 'pending';
  verify.hidden = !((state === 'invalid' && retryable) || state === 'checking');
  verify.disabled = state === 'checking';
  form.hidden = !['ready', 'password-error', 'saving'].includes(state);
  fieldset.disabled = !['ready', 'password-error'].includes(state);
  form.setAttribute('aria-busy', String(state === 'saving'));
  if (state === 'saved' || (state === 'invalid' && !retryable)) {
    for (const input of form.querySelectorAll('input')) { input.value = ''; input.type = 'password'; }
  }
  if (state === 'saved') {
    document.querySelector('[data-reset-next]').href = '/account/sign-in/';
    document.querySelector('[data-reset-next]').textContent = 'Sign in';
  }
}
verify.addEventListener('click', () => controller?.verify());
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!controller || !form.reportValidity()) return;
  const password = form.querySelector('[data-new-password]');
  const confirmation = form.querySelector('[data-confirm-password]');
  await controller.save(password.value, confirmation.value);
});
try {
  const config = await loadLocalAuthConfig(location.origin);
  if (config?.signup) {
    document.querySelector('#account-preview-note').textContent = config.mode === 'development' ? 'Development test only — changes apply to your FAS DEV account.' : 'Local test only — changes apply to local FAS test accounts.';
    if (hash) {
      const { createClient } = await import('./vendor/supabase-client.js');
      // Recovery credentials exist only in memory, never in the ordinary sign-in cache.
      const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'fas-local-recovery-' + crypto.randomUUID() }, global: { fetch: (url, options = {}) => fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) }) } });
      controller = createRecoveryController(client.auth, hash, render);
      verify.hidden = false;
      verify.disabled = false;
      status.hidden = false;
      status.textContent = 'You’ve opened the link from your password recovery email. Select Continue to password reset to check the link and choose a new password.';
    } else render({ state: 'invalid', message: 'Open the recovery link from your email to choose a new password.' });
  }
} catch { render({ state: 'invalid', message: 'Local recovery is unavailable. Reopen your email link after restarting the local preview.' }); }
