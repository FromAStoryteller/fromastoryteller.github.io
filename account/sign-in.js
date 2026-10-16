import { accountEnvironmentNote } from './environment-copy.mjs';
import { loadLocalAuthClient } from './local-auth-client.mjs';
import { createSignInController } from './sign-in-controller.mjs';
import { restoreSession } from './session-controller.mjs';
import { clearPendingEmail } from './pending-email.mjs';

const form = document.querySelector('[data-sign-in-form]');
const fieldset = form.querySelector('fieldset');
const emailInput = form.querySelector('[type=email]');
const passwordInput = form.querySelector('#account-password');
const notice = document.querySelector('#account-preview-note');
const status = document.querySelector('[data-auth-status]');
const signedInPanel = document.querySelector('[data-signed-in]');
const signedInEmail = document.querySelector('[data-signed-in-email]');
const signOutButton = document.querySelector('[data-sign-out]');
const eye = form.querySelector('[data-password-toggle]');
const registerPanel = document.querySelector('.account-register');
const retryButton = document.querySelector('[data-session-retry]');
const rememberInput = form.querySelector('[data-remember-session]');
let local;
let checking = false;
let controller;
let signedIn = false;
let explicitSignOut = false;
let lastChecked = 0;
let authSubscription;
let sessionGeneration = 0;

// Prevent native submissions even if client initialization fails.
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!controller || !form.reportValidity()) return;
  const password = passwordInput.value;
  const remember = rememberInput.checked;
  passwordInput.value = '';
  passwordInput.type = 'password';
  eye.setAttribute('aria-pressed', 'false');
  eye.setAttribute('aria-label', 'Show password');
  eye.querySelector('i').className = 'fa-solid fa-eye';
  fieldset.disabled = true;
  try {
    local = await loadLocalAuthClient({ remember });
    bindController();
    await controller.signIn(emailInput.value, password);
  } catch { render({ state: 'error', message: 'Sign-in is unavailable. Please try again.' }); }
});

function bindController() {
  authSubscription?.unsubscribe();
  controller = createSignInController(local.client.auth, render);
  authSubscription = local.client.auth.onAuthStateChange(event => {
    // Defer Auth work until the SDK callback has released its refresh lock.
    if (event === 'SIGNED_OUT') {
      sessionGeneration++;
      if (signedIn && !explicitSignOut) controller.sessionEnded();
    }
    if (event === 'SIGNED_IN' && !signedIn && !checking) setTimeout(() => { if (!signedIn) void checkSession(); }, 0);
  }).data.subscription;
  notice.textContent = accountEnvironmentNote(local.mode, 'Local test only — ', 'Development test only — uses FAS DEV. ') +
    (!local.storage.persistent ? 'Browser storage is unavailable. Reloading this page signs you out.' :
      local.storage.remembered ? 'Stay signed in across tabs and browser restarts on this device. Sign out when finished on a shared device.' :
        'This sign-in stays in this tab. Browser tab restoration may retain it; sign out when finished.');
}
signOutButton.addEventListener('click', async () => {
  if (!controller) return;
  explicitSignOut = true;
  await controller.signOut();
  explicitSignOut = false;
});
retryButton.addEventListener('click', () => checkSession());

async function checkSession() {
  if (!local || checking) return;
  checking = true;
  const generation = sessionGeneration;
  lastChecked = Date.now();
  render({ state: 'checking', message: 'Checking your session…' });
  const restored = await restoreSession(local.client.auth, local.hadSession || signedIn, () => local.storage.clear());
  if (generation === sessionGeneration) render(restored);
  else render({ state: 'session-ended', message: 'Your session has ended. Please sign in again.' });
  checking = false;
}

function render({ state, message, email }) {
  const busy = state === 'pending' || state === 'signing-out' || state === 'checking';
  if (state === 'signed-in') signedIn = true;
  if (['signed-out', 'session-ended', 'guest', 'session-unavailable'].includes(state)) signedIn = false;
  status.textContent = message;
  status.dataset.state = state.includes('error') || state === 'session-ended' || state === 'session-unavailable' ? 'error' : state.startsWith('signed-') ? 'success' : 'pending';
  status.hidden = !message;
  form.hidden = signedIn;
  signedInPanel.hidden = !signedIn || state === 'checking';
  registerPanel.hidden = signedIn;
  document.querySelector('#sign-in-title').textContent = signedIn ? 'Your account' : 'Sign in';
  fieldset.disabled = busy || state === 'session-unavailable';
  eye.disabled = fieldset.disabled;
  signOutButton.disabled = busy;
  retryButton.hidden = state !== 'session-unavailable';
  form.setAttribute('aria-busy', String(busy));
  if (state === 'signed-in') {
    signedInEmail.textContent = email;
    document.querySelector('[data-signed-in-home]').focus({ preventScroll: true });
  }
  if (state === 'signed-out' || state === 'session-ended' || state === 'session-unavailable') {
    signedInEmail.textContent = '';
    emailInput.value = '';
    if (state === 'session-unavailable') retryButton.focus();
    else emailInput.focus();
  }
  if (state === 'signed-out' || state === 'session-ended') {
    local?.storage.clear();
    clearPendingEmail();
  }
}

try {
  local = await loadLocalAuthClient();
  if (!local) throw new Error('Account services unavailable');
  if (local) {
    bindController();
    rememberInput.checked = local.storage.requestedRemember;
    await checkSession();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && signedIn && Date.now() - lastChecked > 60000 && !explicitSignOut) void checkSession();
    });
    window.addEventListener('pageshow', event => { if (event.persisted) void checkSession(); });
    window.addEventListener('storage', event => {
      if (local.storage.remembered && (event.key === local.storage.key || event.key === null) && event.newValue === null) {
        sessionGeneration++;
        if (signedIn && !explicitSignOut) controller.sessionEnded();
      }
    });
  }
} catch {
  notice.textContent = 'Sign-in is unavailable. Please try again later.';
}
