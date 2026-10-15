import { loadLocalAuthClient } from './local-auth-client.mjs';
import { restoreSession } from './session-controller.mjs';
import { loadAccount, saveProfile, exportAccountData } from './settings-controller.mjs';
const form = document.querySelector('[data-profile-form]');
const status = document.querySelector('[data-auth-status]');
const panel = document.querySelector('[data-account-settings]');
const download = document.querySelector('[data-export-account]');
let local;
let busy = false;
function show(message, error = false) { status.hidden = false; status.textContent = message; status.dataset.state = error ? 'error' : 'success'; }
function render(account) {
  document.querySelector('[data-account-email]').textContent = account.user.email;
  document.querySelector('[data-account-role]').textContent = ({ viewer: 'Viewer', member: 'Contributor', moderator: 'Moderator', admin: 'Administrator' })[account.role] ?? 'Viewer';
  form.querySelector('[data-display-name]').value = account.profile.display_name;
  form.querySelector('[data-bio]').value = account.profile.bio;
  panel.hidden = false;
  form.querySelector('fieldset').disabled = false;
  download.disabled = false;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!local || busy || !form.reportValidity()) return;
  busy = true; form.querySelector('fieldset').disabled = true;
  try {
    await saveProfile(local.client, { displayName: form.querySelector('[data-display-name]').value, bio: form.querySelector('[data-bio]').value });
    show('Your profile was saved.');
  } catch (error) { show(error.message, true); }
  finally { busy = false; form.querySelector('fieldset').disabled = false; }
});
download.addEventListener('click', async () => {
  if (!local || busy) return;
  busy = true; download.disabled = true;
  try {
    const data = await exportAccountData(local.client);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'from-a-storyteller-account.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    show('Your account-data export is ready. Keep it somewhere private. Image originals and unlinked static games are not included.');
  } catch (error) { show(error.message, true); }
  finally { busy = false; download.disabled = false; }
});
try {
  local = await loadLocalAuthClient();
  if (local) {
    document.querySelector('[data-preview-note]').textContent = 'Local test only — these settings apply to your local FAS account.';
    const session = await restoreSession(local.client.auth, local.hadSession, () => local.storage.clear());
    if (session.state !== 'signed-in') show(session.message || 'Sign in to view your account settings.', true);
    else render(await loadAccount(local.client));
  }
} catch { show('We couldn’t load your account settings. Sign in again or try later.', true); }
