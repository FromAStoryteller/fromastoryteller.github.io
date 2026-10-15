import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { requestRecovery, consumeRecoveryLink, createRecoveryController } from '../account/recovery-controller.mjs';
const base = 'http://127.0.0.1:55321';
const inbox = 'http://127.0.0.1:55324';
const key = process.env.FAS_TEST_ANON_KEY;
const secret = process.env.FAS_TEST_SERVICE_KEY;
if (!key || !secret || process.env.FAS_TEST_CONFIRM !== 'LOCAL-FAS-ONLY') throw new Error('Local FAS process credentials and acknowledgement required.');
const email = `fas-recovery-${randomUUID()}@example.invalid`;
const missing = `fas-recovery-${randomUUID()}@example.invalid`;
const oldPassword = 'OldLocal9!' + randomBytes(24).toString('base64url');
const newPassword = 'NewLocal9!' + randomBytes(24).toString('base64url');
const clients = [];
function client() { const c = createClient(base, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: randomUUID() } }); clients.push(c); return c; }
function requireCondition(value) { if (!value) throw new Error('Recovery contract failed'); }
async function admin(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  requireCondition(response.ok); return response.json();
}
async function token(exclude = '') {
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = await fetch(inbox + '/api/v1/search?query=' + encodeURIComponent('to:' + email)).then(r => r.json());
    for (const item of list.messages ?? []) {
      const mail = await fetch(inbox + '/api/v1/message/' + item.ID).then(r => r.json());
      const href = mail.HTML?.match(/href="([^"]*\/account\/reset-password\/[^\"]+)"/)?.[1]?.replaceAll('&amp;', '&');
      if (href) { const value = consumeRecoveryLink(href, () => {}); if (value && value !== exclude) return value; }
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Local recovery email missing');
}
function age(id, interval) {
  requireCondition(/^[0-9a-f-]{36}$/.test(id));
  requireCondition(['65 seconds', '2 hours'].includes(interval));
  execFileSync('docker', ['exec', 'supabase_db_fas-community-v1', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `update auth.users set recovery_sent_at=now()-interval '${interval}' where id='${id}'::uuid`], { stdio: 'ignore', windowsHide: true });
}
let id; let stage = 'create fixture';
try {
  id = (await admin('/auth/v1/admin/users', 'POST', { email, password: oldPassword, email_confirm: true })).id;
  const before = client(); requireCondition(!(await before.auth.signInWithPassword({ email, password: oldPassword })).error);
  const oldRefresh = (await before.auth.getSession()).data.session.refresh_token;
  const requester = client();
  stage = 'generic requests and actual email';
  const known = await requestRecovery(requester.auth, email);
  requireCondition(known.state === 'requested');
  requireCondition(JSON.stringify(await requestRecovery(requester.auth, missing)) === JSON.stringify(known));
  let hash = await token();
  console.log('PASS known and missing addresses receive identical guidance; real local recovery mail arrives');
  requireCondition((await requester.auth.resetPasswordForEmail(email)).error?.status === 429);
  stage = 'expired recovery'; age(id, '2 hours');
  requireCondition((await client().auth.verifyOtp({ token_hash: hash, type: 'recovery' })).error?.code === 'otp_expired');
  requireCondition(!(await requester.auth.resetPasswordForEmail(email)).error);
  hash = await token(hash);
  console.log('PASS repeated requests are throttled and expired recovery links are rejected');
  stage = 'recovery reset';
  const recovery = client(); const states = [];
  const c = createRecoveryController(recovery.auth, hash, s => states.push(s));
  await c.verify(); requireCondition(states.at(-1).state === 'ready');
  requireCondition((await client().auth.verifyOtp({ token_hash: hash, type: 'recovery' })).error);
  await c.save(newPassword, newPassword); requireCondition(states.at(-1).state === 'saved');
  requireCondition((await client().auth.signInWithPassword({ email, password: oldPassword })).error);
  const updated = client(); requireCondition(!(await updated.auth.signInWithPassword({ email, password: newPassword })).error);
  const roles = await updated.from('user_roles').select('role').eq('user_id', id);
  requireCondition(!roles.error && roles.data.length === 0);
  requireCondition((await client().auth.refreshSession({ refresh_token: oldRefresh })).error);
  console.log('PASS single-use link changes the password, rejects the old password, revokes old refresh sessions and preserves viewer permissions');
} catch { console.error(`FAIL ${stage} (credentials withheld)`); process.exitCode = 1; }
finally {
  for (const c of clients) await c.auth.signOut({ scope: 'local' }).catch(() => {});
  try {
    if (id) await admin('/auth/v1/admin/users/' + id, 'DELETE');
    for (const address of [email, missing]) requireCondition((await fetch(inbox + '/api/v1/search?query=' + encodeURIComponent('to:' + address), { method: 'DELETE' })).ok);
    console.log('PASS disposable recovery account and its test emails removed');
  } catch { console.error('FAIL recovery fixture cleanup'); process.exitCode = 1; }
}
