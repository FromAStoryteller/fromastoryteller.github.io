export const LOCAL_ACCOUNT_ORIGIN = 'http://127.0.0.1:55400';
export const LOCAL_AUTH_URL = 'http://127.0.0.1:55321';
export const DEV_ACCOUNT_ORIGIN = 'http://127.0.0.1:55410';
export const DEV_AUTH_URL = 'https://oqmmvjjycpyxvxipcyli.supabase.co';

export function isDevAuthConfig(config) {
  if (config?.mode !== 'development' || config.url !== DEV_AUTH_URL || typeof config.key !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key)) return true;
  try {
    const claims = JSON.parse(atob(config.key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return claims.role === 'anon' && claims.ref === 'oqmmvjjycpyxvxipcyli';
  } catch { return false; }
}

export function accountOrigin(origin) {
  if (![LOCAL_ACCOUNT_ORIGIN, DEV_ACCOUNT_ORIGIN].includes(origin)) throw new Error('Account preview origin is not allowed.');
  return origin;
}

export function isLocalAuthConfig(config) {
  if (config?.url !== LOCAL_AUTH_URL || typeof config.key !== 'string') return false;
  // The local CLI provides an anon JWT. Never accept a privileged key here.
  try {
    const encoded = config.key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return claims.role === 'anon' && claims.iss === 'supabase-demo';
  } catch { return false; }
}

export async function loadLocalAuthConfig(origin, request = fetch) {
  if (![LOCAL_ACCOUNT_ORIGIN, DEV_ACCOUNT_ORIGIN].includes(origin)) return null;
  try {
    const response = await request('/__fas/local-auth', {
      cache: 'no-store', signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    if (!response.ok) return null;
    const config = await response.json();
    return (origin === LOCAL_ACCOUNT_ORIGIN ? isLocalAuthConfig(config) : isDevAuthConfig(config)) ? config : null;
  } catch { return null; }
}
