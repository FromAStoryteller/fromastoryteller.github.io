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
let local;
let checking = false;
let controller;
let signedIn = false;
let explicitSignOut = false;
let lastChecked = 0;

// Prevent native submissions even if client initialization fails.
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!controller || !form.reportValidity()) return;
  const password = passwordInput.value;
  passwordInput.value = '';
  passwordInput.type = 'password';
  eye.setAttribute('aria-pressed', 'false');
  eye.setAttribute('aria-label', 'Show password');
  eye.querySelector('i').className = 'fa-solid fa-eye';
  await controller.signIn(emailInput.value, password);
});
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
  lastChecked = Date.now();
  render({ state: 'checking', message: 'Checking your session…' });
  const restored = await restoreSession(local.client.auth, local.hadSession || signedIn, () => local.storage.clear());
  render(restored);
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
  fieldset.disabled = busy || state === 'session-unavailable';
  eye.disabled = fieldset.disabled;
  signOutButton.disabled = busy;
  retryButton.hidden = state !== 'session-unavailable';
  form.setAttribute('aria-busy', String(busy));
  if (state === 'signed-in') {
    signedInEmail.textContent = email;
    signOutButton.focus();
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
  if (local) {
    const { client } = local;
    controller = createSignInController(client.auth, render);
    client.auth.onAuthStateChange(event => {
      // No async Auth calls inside this callback (SDK lock). RLS remains authoritative.
      if (event === 'SIGNED_OUT' && signedIn && !explicitSignOut) controller.sessionEnded();
    });
    notice.textContent = local.storage.persistent ? 'Local test only — your session is stored in this tab. Sign out when finished.' : 'Local test only — browser storage is unavailable. Reloading this page signs you out.';
    await checkSession();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && signedIn && Date.now() - lastChecked > 60000 && !explicitSignOut) void checkSession();
    });
    window.addEventListener('pageshow', event => { if (event.persisted) void checkSession(); });
  }
} catch {
  notice.textContent = 'Local sign-in is unavailable. Please restart the local preview and try again.';
}
