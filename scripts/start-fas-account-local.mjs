import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localSignupReady } from './fas-local-signup-settings.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
if (!/^project_id = "fas-community-v1"$/m.test(config)) throw new Error('Expected the isolated FAS local project.');
// Capture CLI output in memory, never print its service key or save it to a file.
const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npx.cmd --yes supabase@2.120.0 status -o json']
  : ['--yes', 'supabase@2.120.0', 'status', '-o', 'json'];
let status;
try { status = JSON.parse(execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })); }
catch { console.error('Local FAS Supabase is unavailable. Start Docker and the FAS local stack, then retry.'); process.exit(1); }
if (status.API_URL !== 'http://127.0.0.1:55321') throw new Error('Refusing a non-local Auth target.');
const env = { ...process.env, FAS_LOCAL_AUTH_ENABLED: 'true', FAS_LOCAL_SIGNUP_ENABLED: String(localSignupReady(config)), FAS_LOCAL_ANON_KEY: status.ANON_KEY };
status = null;
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '55400', '--strictPort'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
delete env.FAS_LOCAL_ANON_KEY;
child.on('exit', code => process.exit(code ?? 1));
process.on('SIGINT', () => child.kill('SIGINT'));
