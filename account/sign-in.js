import { loadLocalAuthConfig } from './auth-settings.mjs';
import { createSignInController } from './sign-in-controller.mjs';

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
let controller;
let signedIn = false;
let explicitSignOut = false;

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

function render({ state, message, email }) {
  const busy = state === 'pending' || state === 'signing-out';
  if (state === 'signed-in') signedIn = true;
  if (state === 'signed-out') signedIn = false;
  status.textContent = message;
  status.dataset.state = state.includes('error') ? 'error' : state.startsWith('signed-') ? 'success' : 'pending';
  status.hidden = false;
  form.hidden = signedIn;
  signedInPanel.hidden = !signedIn;
  registerPanel.hidden = signedIn;
  fieldset.disabled = busy;
  eye.disabled = busy;
  signOutButton.disabled = busy;
  form.setAttribute('aria-busy', String(busy));
  if (state === 'signed-in') {
    signedInEmail.textContent = email;
    signOutButton.focus();
  }
  if (state === 'signed-out') {
    signedInEmail.textContent = '';
    emailInput.value = '';
    emailInput.focus();
  }
}

const config = await loadLocalAuthConfig(location.origin);
if (config) {
  try {
    const { createClient } = await import('./vendor/supabase-client.js');
    const client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'fas-local-account-preview' },
      global: { fetch: (url, options = {}) => fetch(url, { ...options, redirect: 'error', signal: AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(15000)]) }) },
    });
    controller = createSignInController(client.auth, render);
    client.auth.onAuthStateChange(event => {
      // No async Auth calls inside this callback (SDK lock). RLS remains authoritative.
      if (event === 'SIGNED_OUT' && signedIn && !explicitSignOut) controller.sessionEnded();
    });
    notice.textContent = 'Local test only — use a test account. Reloading this preview signs you out.';
    fieldset.disabled = false;
    eye.disabled = false;
  } catch {
    notice.textContent = 'Local sign-in is unavailable. Please restart the local preview and try again.';
  }
}
