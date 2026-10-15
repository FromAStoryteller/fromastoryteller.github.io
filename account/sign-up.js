import { loadLocalAuthClient } from './local-auth-client.mjs';
import { createSignupController } from './signup-controller.mjs';
import { passwordChecks } from './password-policy.mjs';
import { savePendingEmail } from './pending-email.mjs';

const form = document.querySelector('[data-sign-up-form]');
const fieldset = form.querySelector('fieldset');
const password = form.querySelector('[data-new-password]');
const confirmation = form.querySelector('[data-confirm-password]');
const email = form.querySelector('[type=email]');
const displayName = form.querySelector('#account-display-name');
const submit = form.querySelector('[type=submit]');
const status = document.querySelector('[data-auth-status]');
let controller;

function show({ state, message, email: requestedEmail }) {
  status.hidden = false;
  status.textContent = message;
  status.dataset.state = state === 'error' ? 'error' : 'pending';
  fieldset.disabled = state === 'pending';
  form.setAttribute('aria-busy', String(state === 'pending'));
  if (state === 'requested') {
    savePendingEmail(requestedEmail);
    location.assign('/account/check-email/');
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!controller || !form.reportValidity()) return;
  if (!displayName.value.trim() || !Object.values(passwordChecks(password.value, confirmation.value)).every(Boolean)) {
    show({ state: 'error', message: 'Enter a display name and make sure both passwords meet the requirements and match.' });
    return;
  }
  const credentials = { displayName: displayName.value, email: email.value, password: password.value, confirmation: confirmation.value,
    ageConfirmed: form.querySelector('[data-age-confirmed]').checked,
    policiesAcknowledged: form.querySelector('[data-policies-acknowledged]').checked };
  for (const input of [password, confirmation]) {
    input.value = '';
    input.type = 'password';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  for (const toggle of form.querySelectorAll('[data-password-toggle]')) {
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', toggle.getAttribute('aria-label').replace(/^Hide /, 'Show '));
    toggle.querySelector('i').className = 'fa-solid fa-eye';
  }
  await controller.signUp(credentials);
});

try {
  const local = await loadLocalAuthClient();
  if (local?.signupEnabled) {
    const settings = await fetch('http://127.0.0.1:55321/auth/v1/settings', { headers: { apikey: local.client.supabaseKey }, signal: AbortSignal.timeout(5000) }).then(response => response.ok ? response.json() : null);
    if (settings?.mailer_autoconfirm === false && settings?.external?.email === true) {
      controller = createSignupController(local.client.auth, show);
      displayName.disabled = false;
      email.disabled = false;
      submit.disabled = false;
      for (const input of form.querySelectorAll('[data-age-confirmed], [data-policies-acknowledged]')) input.disabled = false;
      submit.firstChild.textContent = 'Create test account ';
      document.querySelector('#account-preview-note').textContent = 'Local test only — use a sample account. Emails go to the local test inbox.';
    }
  }
} catch { show({ state: 'error', message: 'Local account creation is unavailable. Please restart the local preview and try again.' }); }
