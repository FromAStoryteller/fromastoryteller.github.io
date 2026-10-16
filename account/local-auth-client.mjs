import { loadAccountAuthConfig } from './auth-settings.mjs';
import { createBrowserSessionStorage } from './session-storage.mjs';

let localClientPromise;

export async function loadLocalAuthClient({ remember } = {}) {
  if (localClientPromise && typeof remember === 'boolean') {
    const previous = await localClientPromise;
    if (previous && previous.storage.requestedRemember !== remember) {
      // No live session is moved. The sign-in form selects persistence before
      // submitting credentials, and disposes the unused client's event channel.
      await previous.client.auth.dispose();
      localClientPromise = null;
    }
  }
  if (!localClientPromise) localClientPromise = initializeClient(remember).catch(error => { localClientPromise = null; throw error; });
  return localClientPromise;
}

async function initializeClient(remember) {
  const [config, { createClient }] = await Promise.all([
    loadAccountAuthConfig(location.origin),
    import('./vendor/supabase-client.js'),
  ]);
  if (!config) return null;
  const storage = createBrowserSessionStorage({ namespace: new URL(config.url).host.replace(/[^a-z0-9-]/gi, '-'), remember });
  const hadSession = storage.hasSession;
  const client = createClient(config.url, config.key, {
    auth: { persistSession: true, storage: storage.adapter, autoRefreshToken: true, detectSessionInUrl: false, storageKey: storage.key },
    global: { fetch: (url, options = {}) => fetch(url, { ...options, redirect: 'error', signal: AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(15000)]) }) },
  });
  return { client, publicImageBase: new URL('/functions/v1/fas-story-image',config.url).href, mode: config.mode ?? 'local', policyRelease: config.policyRelease, accountOrigin: location.origin, signupEnabled: config.signup === true, lifecycleEnabled: config.lifecycle === true, storage, hadSession };
}
