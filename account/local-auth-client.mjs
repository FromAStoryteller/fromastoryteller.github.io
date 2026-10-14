import { loadLocalAuthConfig } from './auth-settings.mjs';

export async function loadLocalAuthClient() {
  const config = await loadLocalAuthConfig(location.origin);
  if (!config) return null;
  const { createClient } = await import('./vendor/supabase-client.js');
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'fas-local-account-preview' },
    global: { fetch: (url, options = {}) => fetch(url, { ...options, redirect: 'error', signal: AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(15000)]) }) },
  });
  return { client, signupEnabled: config.signup === true };
}
