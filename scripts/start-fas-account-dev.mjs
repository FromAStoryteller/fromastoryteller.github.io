import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEV_AUTH_URL, isDevAuthConfig } from '../account/auth-settings.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
// Deliberately fixed to DEV. Capture all CLI keys in memory; expose only anon.
let keys;
try {
  keys = JSON.parse(execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npx', process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx.cmd --yes --offline supabase@2.120.0 projects api-keys --project-ref oqmmvjjycpyxvxipcyli -o json']
    : ['--yes', '--offline', 'supabase@2.120.0', 'projects', 'api-keys', '--project-ref', 'oqmmvjjycpyxvxipcyli', '-o', 'json'],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }));
} catch { throw new Error('FAS DEV access is unavailable. Sign in to the Supabase CLI privately and retry.'); }
const key = keys.find(item => item.name === 'anon' && item.disabled !== true)?.api_key;
keys = null;
if (!isDevAuthConfig({ mode: 'development', url: DEV_AUTH_URL, key })) throw new Error('Expected a nonprivileged FAS DEV key.');
const env = { ...process.env, FAS_DEV_AUTH_ENABLED: 'true', FAS_DEV_SIGNUP_ENABLED: 'true', FAS_DEV_LIFECYCLE_ENABLED: 'true', FAS_DEV_PUBLIC_KEY: key };
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '55410', '--strictPort'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
delete env.FAS_DEV_PUBLIC_KEY;
child.on('exit', code => process.exit(code ?? 1));
process.on('SIGINT', () => child.kill('SIGINT'));
