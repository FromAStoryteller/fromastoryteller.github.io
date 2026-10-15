import { accountEnvironmentNote } from './environment-copy.mjs';
import { loadLocalAuthClient } from './local-auth-client.mjs';
import { createSignupController } from './signup-controller.mjs';
import { passwordChecks } from './password-policy.mjs';
import { savePendingEmail } from './pending-email.mjs';
import { currentPolicyRequirement } from './published-policies.mjs';

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
    policiesAcknowledged: form.querySelector('[data-policies-acknowledged]').checked,
    termsAgreed: form.querySelector('[data-terms-agreed]').checked,
    privacyNoticeSeen: form.querySelector('[data-privacy-seen]').checked };
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
    const settings = await fetch(local.client.supabaseUrl + '/auth/v1/settings', { headers: { apikey: local.client.supabaseKey }, signal: AbortSignal.timeout(5000) }).then(response => response.ok ? response.json() : null);
    if (settings?.mailer_autoconfirm === false && settings?.external?.email === true) {
      const requirement = await currentPolicyRequirement(local.client);
      if (local.mode === 'production' && (!requirement || requirement.release_id !== local.policyRelease)) throw new Error('Published account policies are not ready.');
      controller = createSignupController(local.client.auth, show, local.accountOrigin, requirement);
      displayName.disabled = false;
      email.disabled = false;
      submit.disabled = false;
      for (const input of form.querySelectorAll('[data-age-confirmed], [data-policies-acknowledged]')) input.disabled = false;
      if (requirement) {
        const draft=form.querySelector('[data-policies-acknowledged]');
        draft.disabled=true; draft.required=false; draft.closest('label').hidden=true;
        document.querySelector('#registration-policy-note').textContent='Accounts are for people aged 16 and over. Public reading does not need an account. Review the published policies below. Optional storage choices are separate.';
        for (const kind of ['terms','privacy']) {
          const link=form.querySelector('[data-published-'+kind+']');
          link.href=requirement[kind+'_path'];
          link.textContent=(kind==='terms'?'Terms':'Privacy notice')+' — '+requirement[kind+'_version'];
        }
        for (const input of form.querySelectorAll('[data-terms-agreed], [data-privacy-seen]')) { input.disabled=false; input.closest('label').hidden=false; }
      }
      submit.firstChild.textContent = local.mode === 'production' ? 'Create account ' : 'Create test account ';
      document.querySelector('#account-preview-note').textContent = accountEnvironmentNote(local.mode, 'Local test only — use a sample account. Emails go to the local test inbox.', 'Development test only — uses FAS DEV. Verification emails go to your inbox.', 'Create a viewer account. We’ll email you a verification link.');
    }
  }
} catch { show({ state: 'error', message: 'Account creation is unavailable. Please try again later.' }); }
