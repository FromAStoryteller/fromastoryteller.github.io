export const LOCAL_ACCOUNT_ORIGIN = 'http://127.0.0.1:55400';
export const LOCAL_AUTH_URL = 'http://127.0.0.1:55321';

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
  if (origin !== LOCAL_ACCOUNT_ORIGIN) return null;
  try {
    const response = await request('/__fas/local-auth', {
      cache: 'no-store', signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    if (!response.ok) return null;
    const config = await response.json();
    return isLocalAuthConfig(config) ? config : null;
  } catch { return null; }
}
