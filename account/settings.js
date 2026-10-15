import { loadLocalAuthClient } from './local-auth-client.mjs';
import { restoreSession } from './session-controller.mjs';
import { loadAccount, saveProfile, exportAccountData } from './settings-controller.mjs';
import { downloadOwnedContent, prepareDeletion, confirmDeletion } from './lifecycle-client.mjs';
import { clearPendingEmail } from './pending-email.mjs';
import { accountDataArchive } from './account-data-download.mjs';
const form = document.querySelector('[data-profile-form]');
const status = document.querySelector('[data-auth-status]');
const panel = document.querySelector('[data-account-settings]');
const signInPrompt = document.querySelector('[data-settings-sign-in]');
const download = document.querySelector('[data-export-account]');
const contentDownload = document.querySelector('[data-export-content]');
const deleteStart = document.querySelector('[data-delete-start]');
const passwordForm = document.querySelector('[data-delete-password-form]');
const confirmForm = document.querySelector('[data-delete-confirm-form]');
const contentStatus = document.querySelector('[data-content-status]');
const deletionStatus = document.querySelector('[data-deletion-status]');
let local;
let busy = false;
let prepared = null;
const friendlyError = error => error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'The request took too long. Please try again.' : error instanceof TypeError ? 'We couldn’t connect to account services. Please try again.' : error.message;
function show(message, error = false, pending = false, target = status) { target.hidden = false; target.textContent = message; target.dataset.state = error ? 'error' : pending ? 'pending' : 'success'; }
const showDeletion = (message, error = false, pending = false) => show(message, error, pending, deletionStatus);
function render(account) {
  document.querySelector('[data-account-email]').textContent = account.user.email;
  document.querySelector('[data-account-role]').textContent = ({ viewer: 'Viewer', member: 'Contributor', moderator: 'Moderator', admin: 'Administrator' })[account.role] ?? 'Viewer';
  form.querySelector('[data-display-name]').value = account.profile.display_name;
  form.querySelector('[data-bio]').value = account.profile.bio;
  panel.hidden = false;
  form.querySelector('fieldset').disabled = false;
  download.disabled = false;
  const contributor = ['member', 'moderator', 'admin'].includes(account.role);
  document.querySelector('[data-contributor-export]').hidden = !contributor;
  contentDownload.disabled = !local.lifecycleEnabled || !contributor;
  document.querySelector('[data-delete-export-label]').textContent = contributor ? 'I downloaded my content or choose to continue without a copy.' : 'I understand my account will be permanently deleted.';
  const staff = ['admin','moderator'].includes(account.role);
  deleteStart.hidden = !local.lifecycleEnabled || staff;
  document.querySelector('[data-deletion-unavailable]').hidden = local.lifecycleEnabled && !staff;
  if (account.state === 'closing') {
    form.querySelector('fieldset').disabled = true; download.disabled = true; contentDownload.disabled = true;
    deleteStart.textContent = 'Finish account removal…';
    showDeletion('Removal has started. Profile editing and exports are disabled. Confirm your password to finish the remaining cleanup.', true);
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!local || busy || !form.reportValidity()) return;
  busy = true; form.querySelector('fieldset').disabled = true;
  try {
    await saveProfile(local.client, { displayName: form.querySelector('[data-display-name]').value, bio: form.querySelector('[data-bio]').value });
    show('Your profile was saved.');
  } catch (error) { show(friendlyError(error), true); }
  finally { busy = false; form.querySelector('fieldset').disabled = false; }
});
download.addEventListener('click', async () => {
  if (!local || busy) return;
  busy = true; download.disabled = true;
  try {
    const data = await exportAccountData(local.client);
    const url = URL.createObjectURL(accountDataArchive(data));
    const link = document.createElement('a'); link.href = url; link.download = 'from-a-storyteller-account.zip'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    show('Your account-data ZIP is ready. Open My-account.txt to read your details. Keep the download somewhere private.');
  } catch (error) { show(friendlyError(error), true); }
  finally { busy = false; download.disabled = false; }
});
contentDownload.addEventListener('click', async () => {
  if (!local || busy) return;
  busy = true; contentDownload.disabled = true;
  show('Preparing your content download…', false, true, contentStatus);
  try {
    const blob = await downloadOwnedContent(local);
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'from-a-storyteller-content.zip'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    show('Your content ZIP is ready. Keep it somewhere private and check it opens before deleting anything.', false, false, contentStatus);
  } catch (error) { show(friendlyError(error), true, false, contentStatus); }
  finally { busy = false; contentDownload.disabled = false; }
});
function cancelDeletion() {
  if (busy) return;
  showDeletion(prepared?.started ? 'Removal has already started. You can return to finish the remaining cleanup.' : prepared?.attempted ? 'Confirmation closed. Removal may already have started; check your account before trying again or contact support.' : 'Deletion cancelled. No account or content was removed.');
  prepared = null; passwordForm.reset(); confirmForm.reset();
  passwordForm.hidden = true; confirmForm.hidden = true; deleteStart.hidden = false;
}
deleteStart.addEventListener('click', () => {
  if (busy) return;
  passwordForm.hidden = false; deleteStart.hidden = true;
  passwordForm.querySelector('input').focus();
});
for (const button of document.querySelectorAll('[data-delete-cancel]')) button.addEventListener('click', cancelDeletion);
passwordForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!local || busy || !passwordForm.reportValidity()) return;
  busy = true; passwordForm.querySelector('fieldset').disabled = true;
  const input = passwordForm.querySelector('input'); const password = input.value;
  input.value = ''; input.type = 'password';
  const eye = passwordForm.querySelector('[data-password-toggle]'); eye.setAttribute('aria-label','Show current password'); eye.setAttribute('aria-pressed','false'); eye.querySelector('i').className='fa-solid fa-eye';
  showDeletion('Confirming your account before deletion…', false, true);
  try {
    prepared = await prepareDeletion(local, password); prepared.expiresAt = Date.now() + prepared.expiresIn * 1000;
    const summary = prepared.summary;
    prepared.started = summary.resume;
    confirmForm.querySelector('[data-delete-confirm-info]').textContent = summary.resume ? 'Removal has already started and cannot be undone. Confirm to finish the remaining cleanup.' : 'You can cancel here. Confirming starts permanent removal and cannot be undone.';
    confirmForm.querySelector('[data-delete-cancel]').textContent = summary.resume ? 'Close for now' : 'Cancel';
    document.querySelector('[data-delete-summary]').textContent = `${local.mode === 'development' ? 'Development test only' : 'Local test only'}: this removes your test account, ${summary.stories} owned Community ${summary.stories === 1 ? 'story' : 'stories'} (${summary.published} published) and ${summary.images} uploaded ${summary.images === 1 ? 'image' : 'images'}.`;
    passwordForm.hidden = true; confirmForm.hidden = false;
    showDeletion(summary.resume ? 'Removal has already started. Confirm to retry the remaining cleanup.' : 'Account confirmed. Review the details below before continuing.');
    confirmForm.querySelector('[data-delete-export-choice]').focus();
  } catch (error) { prepared = null; showDeletion(friendlyError(error), true); }
  finally { busy = false; passwordForm.querySelector('fieldset').disabled = false; }
});
confirmForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!local || busy || !prepared || !confirmForm.reportValidity()) return;
  if (Date.now() >= prepared.expiresAt) { cancelDeletion(); showDeletion('Your confirmation expired. Confirm your password again.', true); return; }
  busy = true; confirmForm.querySelector('fieldset').disabled = true; showDeletion('Removing your account and content. Please keep this page open…', false, true);
  try {
    prepared.attempted = true;
    await confirmDeletion(local, prepared);
    await local.client.auth.signOut({ scope: 'local' }).catch(() => {});
    local.storage.clear(); clearPendingEmail(); prepared = null;
    for (const field of document.querySelectorAll('[data-account-settings] input, [data-account-settings] textarea')) field.value = '';
    panel.hidden = true;
    signInPrompt.hidden = false;
    document.querySelector('[data-settings-back]').hidden = true;
    show('Your test account and its owned Community content were deleted. You’re signed out.');
    status.setAttribute('tabindex','-1'); status.focus();
  } catch (error) {
    showDeletion((prepared?.started ? 'Removal has started and cannot be undone. ' : '') + friendlyError(error), true);
    if (prepared?.started) confirmForm.querySelector('[data-delete-cancel]').textContent = 'Close for now';
  }
  finally { busy = false; confirmForm.querySelector('fieldset').disabled = false; }
});
try {
  local = await loadLocalAuthClient();
  if (local) {
    document.querySelector('[data-preview-note]').textContent = local.mode === 'development' ? 'Development test only — these settings apply to your FAS DEV account.' : 'Local test only — these settings apply to your local FAS account.';
    const session = await restoreSession(local.client.auth, local.hadSession, () => local.storage.clear());
    if (session.state !== 'signed-in') {
      show(session.message || 'Sign in to view your account settings.', true);
      signInPrompt.hidden = false;
      document.querySelector('[data-settings-back]').hidden = true;
    }
    else render(await loadAccount(local.client));
  }
} catch {
  show('We couldn’t load your account settings. Sign in again or try later.', true);
  signInPrompt.hidden = false;
  document.querySelector('[data-settings-back]').hidden = true;
}
