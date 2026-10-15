import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { makeLifecycleHandler } from '../supabase/functions/fas-account-lifecycle/handler.mjs';
const base = 'http://127.0.0.1:55321';
const key = process.env.FAS_TEST_ANON_KEY; const secret = process.env.FAS_TEST_SERVICE_KEY;
if (!key || !secret || process.env.FAS_TEST_CONFIRM !== 'LOCAL-FAS-ONLY') throw new Error('Local FAS process credentials and acknowledgement required.');
const endpoint = base + '/functions/v1/fas-account-lifecycle';
const admin = createClient(base, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; const stories = []; const paths = []; const clients = [];
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOAAAAABJRU5ErkJggg==', 'base64'));
const check = value => { if (!value) throw new Error('Lifecycle contract failed'); };
let stage = 'fixtures';
function request(token, body, origin = 'http://127.0.0.1:55400') { return new Request(endpoint, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) }); }
const send = (user, body, origin) => fetch(request(user.token, body, origin));
function sql(text) { execFileSync('docker', ['exec', 'supabase_db_fas-community-v1', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', text], { stdio: 'ignore', windowsHide: true }); }
try {
  for (let i = 0; i < 3; i++) {
    const email = `fas-lifecycle-${randomUUID()}@example.invalid`; const password = 'LocalOnly9!' + randomBytes(24).toString('base64url');
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true }); check(!made.error);
    const user = { id: made.data.user.id, email, password }; users.push(user);
    check(!(await admin.from('user_roles').insert({ user_id: user.id, role: i === 2 ? 'admin' : 'member' })).error);
    const client = createClient(base, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: randomUUID() } }); clients.push(client);
    const signed = await client.auth.signInWithPassword({ email, password }); check(!signed.error); user.token = signed.data.session.access_token; user.refresh = signed.data.session.refresh_token;
  }
  for (let i = 0; i < 2; i++) {
    const story = await clients[i].from('stories').insert({ author_id: users[i].id, slug: 'fas-lifecycle-' + randomUUID(), title: 'Owned disposable draft', body: 'Private original body ' + i }).select('id').single(); check(!story.error); stories.push(story.data.id);
    const path = `${users[i].id}/${story.data.id}/${randomUUID()}.png`; paths.push(path);
    check(!(await clients[i].from('story_assets').insert({ story_id: story.data.id, object_path: path, alt_text: 'Disposable original' })).error);
    check(!(await clients[i].storage.from('fas-story-images').upload(path, png, { contentType: 'image/png', upsert: false })).error);
  }
  const published = await admin.from('stories').insert({ author_id: users[0].id, slug: 'fas-lifecycle-' + randomUUID(), title: 'Owned disposable published story', body: 'Published original', status: 'published', published_at: new Date().toISOString() }).select('id').single(); check(!published.error); stories.push(published.data.id);
  check(!(await admin.from('moderation_log').insert({ story_id: published.data.id, actor_id: users[2].id, from_status: 'submitted', to_status: 'published', reason: 'Disposable lifecycle fixture' })).error);
  stage = 'denied callers';
  check((await fetch(endpoint, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{"action":"export"}' })).status === 401);
  check((await send(users[0], { action: 'export' }, 'https://untrusted.invalid')).status === 403);
  const sessionId = JSON.parse(Buffer.from(users[0].token.split('.')[1], 'base64url')).session_id;
  check((await clients[0].rpc('fas_account_snapshot', { target_user: users[0].id, target_session: sessionId })).error);
  check((await send(users[0], { action: 'prepare-delete', password: 'wrong' })).status === 403);
  check((await send(users[2], { action: 'prepare-delete', password: users[2].password })).status === 403);
  console.log('PASS anonymous/cross-origin callers, direct privileged RPCs, wrong passwords and staff self-deletion are denied');
  stage = 'complete owned content archive';
  const exported = await send(users[0], { action: 'export', target_user: users[1].id });
  if (!exported.ok) { const failure = await exported.json(); console.error('Export HTTP status: ' + exported.status + '; ' + failure.message); }
  check(exported.ok && exported.headers.get('Content-Type') === 'application/zip');
  check(exported.headers.get('Cache-Control').includes('no-store'));
  const file = new URL('../../lifecycle-test-export.zip', import.meta.url); writeFileSync(file, new Uint8Array(await exported.arrayBuffer()));
  const python = process.env.FAS_TEST_PYTHON;
  if (!python) throw new Error('Set FAS_TEST_PYTHON to a trusted Python interpreter for independent ZIP verification');
  const program = `import sys,json,zipfile\nz=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None\na=json.loads(z.read('account.json')); m=json.loads(z.read('manifest.json'))\nassert a['id']==sys.argv[2] and m['stories']==2 and m['images']==1\nassert z.read('images/'+sys.argv[4])==bytes.fromhex(sys.argv[5])\nassert not any(sys.argv[3] in n for n in z.namelist())\nassert not any(k in z.read('account.json').decode() for k in ['access_token','refresh_token','encrypted_password'])\nassert any(json.loads(z.read(n)).get('body')=='Private original body 0' for n in z.namelist() if n.startswith('stories/'))\nprint('PASS independent ZIP reader verifies owned draft/published text and exact original image bytes; no other account or credentials')`;
  execFileSync(python, ['-c', program, fileURLToPath(file), users[0].id, users[1].id, paths[0], Buffer.from(png).toString('hex')], { stdio: 'inherit', windowsHide: true }); rmSync(file);
  stage = 'missing originals fail clearly';
  check(!(await admin.storage.from('fas-story-images').remove([paths[0]])).error);
  check((await send(users[0], { action: 'export' })).status === 409);
  check(!(await admin.auth.admin.getUserById(users[0].id)).error);
  check(!(await clients[0].storage.from('fas-story-images').upload(paths[0], png, { contentType: 'image/png', upsert: false })).error);
  stage = 'two-step deletion';
  check((await send(users[0], { action: 'confirm-delete', confirmation: 'DELETE', exportAcknowledged: true, confirmationToken: 'a'.repeat(64) })).status === 409);
  stage = 'password reauthentication and summary';
  const preparation = await send(users[0], { action: 'prepare-delete', password: users[0].password }); check(preparation.ok);
  const prepared = await preparation.json(); check(prepared.summary.stories === 2 && prepared.summary.images === 1 && prepared.summary.published === 1);
  const confirm = { action: 'confirm-delete', confirmation: 'DELETE', exportAcknowledged: true, confirmationToken: prepared.confirmationToken };
  check((await send(users[0], { ...confirm, exportAcknowledged: false })).status === 400);
  let failedOnce = false;
  const interrupted = makeLifecycleHandler({ base, anonKey: key, serviceKey: secret, enabled: true }, async (url, options) => {
    if (!failedOnce && options?.method === 'DELETE' && String(url).includes('/storage/v1/object/')) { failedOnce = true; return new Response('{}', { status: 503 }); }
    return fetch(url, options);
  });
  stage = 'interrupted file cleanup';
  const stopped = await interrupted(request(users[0].token, confirm));
  if (!failedOnce) console.error('Interruption response: ' + stopped.status + '; ' + (await stopped.clone().json()).message);
  check(stopped.status === 503 && failedOnce);
  stage = 'closing-account write freeze';
  check((await admin.from('stories').select('id').eq('author_id', users[0].id)).data.length === 0);
  const frozen = await clients[0].from('profiles').update({ bio: 'Should be blocked' }).eq('id', users[0].id).select('id'); check(frozen.error || frozen.data.length === 0);
  check((await clients[0].from('stories').insert({ author_id: users[0].id, slug: 'blocked-' + randomUUID(), title: 'Blocked', body: '' })).error);
  check((await admin.from('user_roles').update({ role: 'admin' }).eq('user_id', users[0].id)).error);
  stage = 'resume confirmed deletion';
  const completed = await send(users[0], confirm); if (!completed.ok) console.error('Retry response: ' + completed.status + '; ' + (await completed.clone().json()).message); check(completed.ok && (await completed.json()).state === 'deleted');
  stage = 'verify identity/files removed and other author preserved';
  check((await admin.auth.admin.getUserById(users[0].id)).error);
  const receipt = await send(users[0], { action: 'deletion-status', userId: users[0].id, confirmationToken: prepared.confirmationToken }); check(receipt.ok && (await receipt.json()).state === 'complete');
  const wrongReceipt = await send(users[0], { action: 'deletion-status', userId: users[1].id, confirmationToken: prepared.confirmationToken }); check((await wrongReceipt.json()).state === 'unknown');
  check((await clients[0].auth.refreshSession({ refresh_token: users[0].refresh })).error);
  check((await clients[1].from('stories').select('body').eq('id', stories[1]).single()).data.body === 'Private original body 1');
  check((await admin.storage.from('fas-story-images').download(paths[0])).error);
  check(!(await admin.storage.from('fas-story-images').download(paths[1])).error);
  const otherSession = JSON.parse(Buffer.from(users[1].token.split('.')[1], 'base64url')).session_id;
  check(/^[0-9a-f-]{36}$/.test(otherSession));
  sql(`update auth.sessions set not_after=now()-interval '1 second' where id='${otherSession}'::uuid and user_id='${users[1].id}'::uuid`);
  check((await send(users[1], { action: 'export' })).status === 401);
  console.log('PASS confirmed deletion hides/removes owned content, freezes writes, resumes after a Storage failure, removes originals/login and preserves the other author');
} catch { console.error(`FAIL ${stage} (credentials withheld)`); process.exitCode = 1; }
finally {
  rmSync(new URL('../../lifecycle-test-export.zip', import.meta.url), { force: true });
  for (const c of clients) await c.auth.signOut({ scope: 'local' }).catch(() => {});
  try {
    if (paths.length) check(!(await admin.storage.from('fas-story-images').remove(paths)).error);
    for (const id of stories) { check(!(await admin.from('moderation_log').delete().eq('story_id', id)).error); check(!(await admin.from('stories').delete().eq('id', id)).error); }
    for (const user of users) { const existing = await admin.auth.admin.getUserById(user.id); if (!existing.error) check(!(await admin.auth.admin.deleteUser(user.id)).error); if (/^[0-9a-f-]{36}$/.test(user.id)) sql(`delete from private.account_deletion_jobs where user_id='${user.id}'::uuid`); }
    console.log('PASS lifecycle fixtures and deletion-test records removed');
  } catch { console.error('FAIL lifecycle fixture cleanup'); process.exitCode = 1; }
}
