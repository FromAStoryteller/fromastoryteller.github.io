import { loadAccountAuthConfig } from './auth-settings.mjs';
import { createSessionStorage } from './session-storage.mjs';

let localClientPromise;

export async function loadLocalAuthClient() {
  if (!localClientPromise) localClientPromise = initializeClient().catch(error => { localClientPromise = null; throw error; });
  return localClientPromise;
}

async function initializeClient() {
  const config = await loadAccountAuthConfig(location.origin);
  if (!config) return null;
  const { createClient } = await import('./vendor/supabase-client.js');
  const storage = createSessionStorage();
  const hadSession = storage.hasSession;
  const client = createClient(config.url, config.key, {
    auth: { persistSession: true, storage: storage.adapter, autoRefreshToken: true, detectSessionInUrl: false, storageKey: storage.key },
    global: { fetch: (url, options = {}) => fetch(url, { ...options, redirect: 'error', signal: AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(15000)]) }) },
  });
  return { client, mode: config.mode ?? 'local', policyRelease: config.policyRelease, accountOrigin: location.origin, signupEnabled: config.signup === true, lifecycleEnabled: config.lifecycle === true, storage, hadSession };
}
