import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { accountDataArchive } from '../account/account-data-download.mjs';
import { loadAccount, saveProfile, exportAccountData } from '../account/settings-controller.mjs';
const base = 'http://127.0.0.1:55321';
const key = process.env.FAS_TEST_ANON_KEY;
const secret = process.env.FAS_TEST_SERVICE_KEY;
if (!key || !secret || process.env.FAS_TEST_CONFIRM !== 'LOCAL-FAS-ONLY') throw new Error('Local FAS process credentials and acknowledgement required.');
const admin = createClient(base, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; const clients = []; const stories = [];
const check = value => { if (!value) throw new Error('Account settings contract failed'); };
let stage = 'fixtures';
try {
  for (let i = 0; i < 2; i++) {
    const email = `fas-settings-${randomUUID()}@example.invalid`;
    const password = 'LocalOnly9!' + randomBytes(24).toString('base64url');
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true }); check(!made.error);
    users.push(made.data.user.id);
    const client = createClient(base, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: randomUUID() } }); clients.push(client);
    check(!(await client.auth.signInWithPassword({ email, password })).error);
  }
  stage = 'profile edits';
  const saved = await saveProfile(clients[0], { displayName: 'Local profile reader', bio: 'Disposable local profile.' });
  check(saved.display_name === 'Local profile reader');
  check((await loadAccount(clients[0])).role === 'viewer');
  const other = await clients[0].from('profiles').update({ display_name: 'Tampered' }).eq('id', users[1]).select('id'); check(other.error || other.data.length === 0);
  check((await loadAccount(clients[1])).profile.display_name === 'Storyteller');
  console.log('PASS viewer can edit their own profile but cannot edit another profile or gain contributor access');
  const viewerExport = await exportAccountData(clients[0]);
  check(viewerExport.account.role === 'viewer' && !('stories' in viewerExport));
  check((await accountDataArchive(viewerExport).arrayBuffer()).byteLength > 0);
  stage = 'personal data export excludes contributor content';
  for (let i = 0; i < 2; i++) {
    check(!(await admin.from('user_roles').insert({ user_id: users[i], role: 'member' })).error);
    const row = await clients[i].from('stories').insert({ author_id: users[i], slug: 'fas-settings-' + randomUUID(), title: 'Disposable draft', body: 'Private text ' + i }).select('id').single(); check(!row.error); stories.push(row.data.id);
  }
  const exported = await exportAccountData(clients[0]);
  check(exported.account.user.id === users[0] && !('stories' in exported) && !JSON.stringify(exported).includes('Private text 0'));
  check(!JSON.stringify(exported).includes(users[1]));
  check(!/access_token|refresh_token|encrypted_password/.test(JSON.stringify(exported)));
  check(exported.excludes.includes('Contributor content (available separately)'));
  console.log('PASS viewers and contributors can export personal account data without story content, other accounts or credentials');
} catch { console.error(`FAIL ${stage} (credentials withheld)`); process.exitCode = 1; }
finally {
  for (const client of clients) await client.auth.signOut({ scope: 'local' }).catch(() => {});
  try {
    for (const id of stories) check(!(await admin.from('stories').delete().eq('id', id)).error);
    for (const id of users) check(!(await admin.auth.admin.deleteUser(id)).error);
    console.log('PASS disposable profile/content fixtures removed');
  } catch { console.error('FAIL settings fixture cleanup'); process.exitCode = 1; }
}
