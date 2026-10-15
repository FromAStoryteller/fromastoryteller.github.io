import { loadLocalAuthClient } from './local-auth-client.mjs';
import { requestRecovery } from './recovery-controller.mjs';

const form = document.querySelector('[data-recover-form]');
const fieldset = form.querySelector('fieldset');
const status = document.querySelector('[data-auth-status]');
let auth;
let busy = false;
let nextRequest = 0;
const button = form.querySelector('button');
function updateButton() {
  const remaining = Math.max(0, Math.ceil((nextRequest - Date.now()) / 1000));
  button.disabled = !auth || busy || remaining > 0;
  button.textContent = busy ? 'Requesting email…' : remaining ? `Try again in ${remaining}s` : 'Send recovery email';
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!auth || busy || Date.now() < nextRequest || !form.reportValidity()) return;
  busy = true;
  updateButton();
  fieldset.disabled = true;
  status.hidden = false;
  status.dataset.state = 'pending';
  status.textContent = 'Requesting your recovery email…';
  const result = await requestRecovery(auth, form.querySelector('input').value);
  nextRequest = Date.now() + 60000;
  busy = false;
  fieldset.disabled = false;
  updateButton();
  status.dataset.state = result.state === 'error' ? 'error' : 'success';
  status.textContent = result.message;
  if (result.state === 'requested') location.assign('/account/recovery-email/');
});
try {
  const local = await loadLocalAuthClient();
  if (local?.signupEnabled) {
    auth = local.client.auth;
    fieldset.disabled = false;
    updateButton();
    setInterval(updateButton, 1000);
    document.querySelector('#account-preview-note').textContent = 'Local test only — recovery emails go to the local test inbox.';
  }
} catch { status.hidden = false; status.dataset.state = 'error'; status.textContent = 'Local recovery is unavailable. Please restart the local preview and try again.'; }
