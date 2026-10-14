// Real Auth, PostgREST and Storage requests. Disposable LOCAL FAS only.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = 'http://127.0.0.1:55321'; // Intentionally cannot target hosted projects.
const bucket = 'fas-story-images';
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
assert.match(config, /^project_id = "fas-community-v1"$/m);
assert.match(config, /^port = 55321$/m);
if (process.env.FAS_TEST_CONFIRM !== 'fas-community-v1') {
  throw new Error('Set FAS_TEST_CONFIRM=fas-community-v1 to authorize disposable local fixtures. See docs/backend/security.md.');
}
const anonKey = process.env.FAS_TEST_ANON_KEY;
const serviceKey = process.env.FAS_TEST_SERVICE_KEY;
assert.ok(anonKey && serviceKey, 'Supply LOCAL FAS keys via environment, never command arguments or committed files.');
if (anonKey.split('.').length === 3) {
  const claims = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url'));
  assert.equal(claims.role, 'anon', 'Client tests require anon, never service_role.');
} else assert.ok(anonKey.startsWith('sb_publishable_'), 'Expected a publishable or legacy anon key.');

// Responses/tokens/passwords are never printed, including on failure.
let lastRequest = 'local setup';
async function request(path, { token, method = 'GET', body, bytes, privileged = false, headers = {} } = {}) {
  lastRequest = `${method} ${path.split('?')[0]}`;
  const key = privileged ? serviceKey : anonKey;
  const bearer = token ?? (key.startsWith('sb_') ? undefined : key);
  const response = await fetch(base + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: bytes ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, ok: response.ok, data };
}
function success(result, name) { assert.ok(result.ok, `${name}: HTTP ${result.status}`); return result.data; }
function rejected(result, name) {
  assert.ok([400, 401, 403, 404, 409, 413, 415].includes(result.status), `${name}: expected denial, got HTTP ${result.status}`);
}
function empty(result, name) { const rows = success(result, name); assert.ok(Array.isArray(rows) && rows.length === 0, name); }
async function unchanged(path, token, body, name) {
  const result = await request(path, { token, method: 'PATCH', body, headers: { Prefer: 'return=representation' } });
  if (result.ok) empty(result, name); else rejected(result, name);
}
let passed = 0;
function pass(name) { passed++; console.log(`PASS ${name}`); }
const users = [], stories = [], objects = [], invites = [];
const run = randomUUID();
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1sAAAAASUVORK5CYII=', 'base64');
const rest = '/rest/v1/';
async function fixtureUser(label, role) {
  const email = `fas-security-${run}-${label}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const user = success(await request('/auth/v1/admin/users', { privileged: true, method: 'POST',
    body: { email, password, email_confirm: true, user_metadata: { role: 'admin', is_admin: true } } }), 'Create fixture account');
  users.push(user.id);
  if (role) success(await request(rest + 'user_roles', { privileged: true, method: 'POST',
    body: { user_id: user.id, role } }), 'Assign fixture role');
  const session = success(await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }), 'Sign in fixture');
  assert.ok(session.access_token, 'Missing fixture session');
  return { id: user.id, email, token: session.access_token };
}
async function createStory(user, label) {
  const rows = success(await request(rest + 'stories', { token: user.token, method: 'POST',
    body: { author_id: user.id, slug: `fas-security-${run}-${label}`, title: label, body: 'Synthetic test text' },
    headers: { Prefer: 'return=representation' } }), 'Create contributor draft');
  assert.equal(rows.length, 1);
  stories.push(rows[0].id);
  return rows[0];
}
async function upload(user, story, register = true) {
  const path = `${user.id}/${story.id}/${randomUUID()}.png`;
  success(await request(`/storage/v1/object/${bucket}/${path}`, { token: user.token, method: 'POST', bytes: image,
    headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' } }), 'Upload image');
  objects.push(path);
  let asset;
  if (register) asset = success(await request(rest + 'story_assets', { token: user.token, method: 'POST',
    body: { story_id: story.id, object_path: path, alt_text: 'Synthetic image' }, headers: { Prefer: 'return=representation' } }), 'Register image')[0];
  return { path, asset };
}
const rpc = (name, user, body) => request(rest + `rpc/${name}`, { token: user?.token, method: 'POST', body });
const getStory = (id, user) => request(rest + `stories?id=eq.${id}`, { token: user?.token });
const download = (path, user) => request(`/storage/v1/object/authenticated/${bucket}/${path}`, { token: user?.token });
const sign = (path, user) => request(`/storage/v1/object/sign/${bucket}/${path}`, { token: user?.token, method: 'POST', body: { expiresIn: 60 } });

let failure = false;
try {
  // Check reachability before creating anything; the fixed URL prevents production writes.
  success(await request('/auth/v1/health'), 'Local Auth health');
  const viewer = await fixtureUser('viewer');
  const owner = await fixtureUser('author', 'member');
  const other = await fixtureUser('other', 'member');
  const admin = await fixtureUser('admin', 'admin');
  const moderator = await fixtureUser('moderator', 'moderator');
  for (const user of [viewer, owner, admin]) rejected(await request(`/storage/v1/bucket/${bucket}`, {
    token: user.token, method: 'PUT', body: { name: bucket, public: true },
  }), 'Client cannot make image bucket public');
  const bucketState = success(await request(`/storage/v1/bucket/${bucket}`, { privileged: true }), 'Inspect local bucket');
  assert.equal(bucketState.public, false);
  const draft = await createStory(owner, 'draft');
  const published = await createStory(owner, 'published');
  const otherDraft = await createStory(other, 'other');
  const draftImage = await upload(owner, draft);
  const approved = await upload(owner, published);
  const unapproved = await upload(owner, published);
  const orphan = await upload(owner, published, false);

  for (const user of [undefined, viewer, other]) {
    empty(await getStory(draft.id, user), 'Private draft hidden');
    empty(await request(rest + `story_assets?story_id=eq.${draft.id}`, { token: user?.token }), 'Private metadata hidden');
    rejected(await download(draftImage.path, user), 'Draft bytes denied');
    rejected(await sign(draftImage.path, user), 'Draft signed URL denied');
    empty(await request(`/storage/v1/object/list/${bucket}`, { token: user?.token, method: 'POST',
      body: { prefix: `${owner.id}/${draft.id}`, limit: 100 } }), 'Draft object listing hidden');
  }
  assert.equal(success(await getStory(draft.id, owner), 'Owner draft read').length, 1);
  assert.equal(success(await getStory(draft.id, admin), 'Admin draft read').length, 1);
  success(await download(draftImage.path, owner), 'Owner image download');
  success(await download(draftImage.path, admin), 'Admin image download');
  pass('Anonymous/viewer/other contributor cannot read private drafts or image bytes; owner/admin can');

  for (const user of [undefined, viewer]) rejected(await request(rest + 'stories', { token: user?.token, method: 'POST',
    body: { author_id: viewer.id, slug: `forbidden-${randomUUID()}`, title: 'Denied' } }), 'Viewer/anonymous creation');
  rejected(await request(rest + 'stories', { token: owner.token, method: 'POST',
    body: { author_id: other.id, slug: `forged-${randomUUID()}`, title: 'Denied' } }), 'Forged ownership');
  await unchanged(rest + `stories?id=eq.${otherDraft.id}`, owner.token, { body: 'Tampered' }, 'Other author update denied');
  await unchanged(rest + `stories?id=eq.${otherDraft.id}`, admin.token, { body: 'Tampered' }, 'Admin direct rewrite denied');
  rejected(await request(rest + `stories?id=eq.${draft.id}`, { token: owner.token, method: 'PATCH', body: { author_id: other.id } }), 'Ownership transfer');
  rejected(await request(rest + `stories?id=eq.${draft.id}`, { token: owner.token, method: 'DELETE' }), 'Story deletion');
  assert.equal(success(await getStory(otherDraft.id, other), 'Verify victim story')[0].body, 'Synthetic test text');
  pass('Only contributors create their own drafts; ownership and another author’s work are protected');

  for (const user of [viewer, owner, admin]) {
    rejected(await request(rest + `user_roles?user_id=eq.${user.id}`, { token: user.token, method: 'PATCH', body: { role: 'admin' } }), 'Role update');
    rejected(await request(rest + 'user_roles', { token: user.token, method: 'POST',
      body: { user_id: user.id, role: 'admin' }, headers: { Prefer: 'resolution=merge-duplicates' } }), 'Role upsert');
    rejected(await request(rest + `user_roles?user_id=eq.${user.id}`, { token: user.token, method: 'DELETE' }), 'Role delete');
  }
  empty(await request(rest + `user_roles?user_id=eq.${viewer.id}`, { token: viewer.token }), 'Auth metadata did not grant a role');
  rejected(await request(rest + `profiles?id=eq.${owner.id}`, { token: owner.token, method: 'PATCH', body: { id: admin.id } }), 'Profile identity');
  await unchanged(rest + `profiles?id=eq.${other.id}`, owner.token, { bio: 'Tampered' }, 'Other profile update');
  for (const user of [undefined, viewer, owner]) {
    rejected(await request(rest + 'invites', { token: user?.token }), 'Invite table privacy');
    rejected(await rpc('create_invite', user, { invitee_email: 'nobody@example.invalid' }), 'Unauthorized invite');
    rejected(await rpc('moderate_story', user, { target_story: draft.id, decision: 'published', note: 'Denied' }), 'Unauthorized moderation');
    rejected(await rpc('approve_story_image', user, { target_asset: draftImage.asset.id }), 'Unauthorized image approval');
  }
  pass('Role escalation, metadata spoofing, profile tampering and privileged RPCs are denied');

  rejected(await request(`/storage/v1/object/${bucket}/${other.id}/${otherDraft.id}/${randomUUID()}.png`,
    { token: owner.token, method: 'POST', bytes: image, headers: { 'Content-Type': 'image/png' } }), 'Other author upload');
  rejected(await request(`/storage/v1/object/${bucket}/${owner.id}/${draft.id}/${randomUUID()}.svg`,
    { token: owner.token, method: 'POST', bytes: Buffer.from('<svg/>'), headers: { 'Content-Type': 'image/svg+xml' } }), 'SVG upload');
  rejected(await request(`/storage/v1/object/${bucket}/${owner.id}/${draft.id}/${randomUUID()}.png`,
    { token: owner.token, method: 'POST', bytes: Buffer.alloc(5242881), headers: { 'Content-Type': 'image/png' } }), 'Oversize upload');
  for (const user of [undefined, viewer]) rejected(await request(`/storage/v1/object/${bucket}/${owner.id}/${draft.id}/${randomUUID()}.png`,
    { token: user?.token, method: 'POST', bytes: image, headers: { 'Content-Type': 'image/png' } }), 'Reader upload');
  rejected(await download(orphan.path, owner), 'Unregistered image download');
  rejected(await request(`/storage/v1/object/public/${bucket}/${draftImage.path}`), 'Public URL bypass');
  rejected(await request(rest + `story_assets?id=eq.${approved.asset.id}`, { token: owner.token, method: 'PATCH', body: { approved_at: new Date().toISOString(), approved_by: owner.id } }), 'Self image approval');
  success(await rpc('approve_story_image', admin, { target_asset: approved.asset.id }), 'Admin approve image');
  // Editing its alt text must invalidate the previous approval.
  success(await request(rest + `story_assets?id=eq.${approved.asset.id}`, { token: owner.token, method: 'PATCH', body: { alt_text: 'Revised image description' } }), 'Edit image description');
  assert.equal(success(await request(rest + `story_assets?id=eq.${approved.asset.id}`, { token: owner.token }), 'Read revised image')[0].approved_at, null);
  success(await rpc('approve_story_image', moderator, { target_asset: approved.asset.id }), 'Moderator approve revised image');
  pass('Image ownership, MIME/size limits, private bucket and separate staff approval enforced');

  rejected(await request(rest + `stories?id=eq.${published.id}`, { token: owner.token, method: 'PATCH', body: { status: 'published' } }), 'Direct author publication');
  success(await request(rest + `stories?id=eq.${published.id}`, { token: owner.token, method: 'PATCH', body: { status: 'submitted' } }), 'Submit story');
  await unchanged(rest + `stories?id=eq.${published.id}`, owner.token, { body: 'Changed under review' }, 'Submitted story frozen');
  success(await rpc('moderate_story', admin, { target_story: published.id, decision: 'published', note: 'Synthetic approval' }), 'Publish');
  for (const user of [undefined, viewer, other]) {
    assert.equal(success(await getStory(published.id, user), 'Public published story').length, 1);
    const assets = success(await request(rest + `story_assets?story_id=eq.${published.id}`, { token: user?.token }), 'Public asset metadata');
    assert.deepEqual(assets.map(a => a.id), [approved.asset.id]);
    success(await download(approved.path, user), 'Approved public image');
    success(await sign(approved.path, user), 'Approved signed URL');
    rejected(await download(unapproved.path, user), 'Unapproved bytes');
    rejected(await sign(unapproved.path, user), 'Unapproved signed URL');
    rejected(await download(orphan.path, user), 'Orphan bytes');
  }
  await unchanged(rest + `stories?id=eq.${published.id}`, owner.token, { body: 'Changed after publication' }, 'Published story frozen');
  for (const user of [owner, other, admin]) {
    rejected(await request(`/storage/v1/object/${bucket}/${approved.path}`, { token: user.token, method: 'PUT', bytes: image, headers: { 'Content-Type': 'image/png' } }), 'Image overwrite');
    rejected(await request(`/storage/v1/object/${bucket}/${approved.path}`, { token: user.token, method: 'POST', bytes: image, headers: { 'Content-Type': 'image/png', 'x-upsert': 'true' } }), 'Image upsert');
    rejected(await request('/storage/v1/object/move', { token: user.token, method: 'POST',
      body: { bucketId: bucket, sourceKey: approved.path, destinationKey: `${owner.id}/${draft.id}/${randomUUID()}.png` } }), 'Image move');
    const deleted = await request(`/storage/v1/object/${bucket}`, { token: user.token, method: 'DELETE', body: { prefixes: [approved.path] } });
    if (deleted.ok) empty(deleted, 'Image delete returned zero objects'); else rejected(deleted, 'Image delete');
    success(await download(approved.path), 'Verify image survived');
  }
  pass('Public readers see published text and approved images only; reviewed content cannot be replaced');

  rejected(await request(rest + 'moderation_log', { token: owner.token, method: 'POST', body: {} }), 'Forged moderation log');
  rejected(await request(rest + 'moderation_log', { token: admin.token, method: 'DELETE' }), 'Audit deletion');
  success(await rpc('moderate_story', admin, { target_story: published.id, decision: 'archived', note: 'Synthetic archival' }), 'Archive');
  for (const user of [undefined, viewer, other]) {
    empty(await getStory(published.id, user), 'Archive hidden');
    rejected(await download(approved.path, user), 'Archived bytes');
    rejected(await sign(approved.path, user), 'New signed URL after archival');
  }
  const audit = success(await request(rest + `moderation_log?story_id=eq.${published.id}`, { token: admin.token }), 'Audit read');
  assert.equal(audit.length, 2);
  pass('Archival removes public access and moderation leaves an immutable client audit trail');

  async function inviteFor(email) {
    const token = success(await rpc('create_invite', admin, { invitee_email: email, valid_days: 7 }), 'Admin create invite');
    const hash = createHash('sha256').update(token).digest('hex');
    const rows = success(await request(rest + `invites?token_hash=eq.${hash}`, { privileged: true }), 'Locate synthetic invite');
    assert.equal(rows.length, 1);
    invites.push(rows[0].id);
    return { token, id: rows[0].id };
  }
  const expired = await inviteFor(viewer.email);
  success(await request(rest + `invites?id=eq.${expired.id}`, { privileged: true, method: 'PATCH',
    body: { created_at: '2000-01-01T00:00:00Z', expires_at: '2000-01-02T00:00:00Z' } }), 'Expire synthetic invite');
  rejected(await rpc('accept_invite', viewer, { invite_token: expired.token }), 'Expired invite');
  const revoked = await inviteFor(viewer.email);
  success(await rpc('revoke_invite', admin, { invite_id: revoked.id }), 'Revoke synthetic invite');
  rejected(await rpc('accept_invite', viewer, { invite_token: revoked.token }), 'Revoked invite');
  const valid = await inviteFor(viewer.email);
  rejected(await rpc('accept_invite', other, { invite_token: valid.token }), 'Wrong email invite');
  success(await rpc('accept_invite', viewer, { invite_token: valid.token }), 'Accept matching verified invite');
  rejected(await rpc('accept_invite', viewer, { invite_token: valid.token }), 'Reused invite');
  const roles = success(await request(rest + `user_roles?user_id=eq.${viewer.id}`, { token: viewer.token }), 'Accepted role');
  assert.equal(roles.length, 1);
  assert.equal(roles[0].role, 'member');
  pass('Only matching verified users accept active single-use invites; invites grant contributor, never admin');
} catch (error) {
  failure = true;
  console.error('FAIL: API security check or local service setup failed. Response bodies and credentials suppressed.');
  console.error(`Last operation: ${lastRequest}`);
  if (error instanceof assert.AssertionError) console.error(error.message.split('\n')[0]);
} finally {
  // Only random fixture IDs/paths recorded by this run; never reset the database.
  try {
    if (objects.length) success(await request(`/storage/v1/object/${bucket}`, { privileged: true, method: 'DELETE', body: { prefixes: objects } }), 'Cleanup fixture objects');
    for (const id of stories) {
      success(await request(rest + `moderation_log?story_id=eq.${id}`, { privileged: true, method: 'DELETE' }), 'Cleanup fixture audit');
      success(await request(rest + `stories?id=eq.${id}`, { privileged: true, method: 'DELETE' }), 'Cleanup fixture story');
    }
    for (const id of invites) success(await request(rest + `invites?id=eq.${id}`, { privileged: true, method: 'DELETE' }), 'Cleanup fixture invite');
    for (const id of users) success(await request(`/auth/v1/admin/users/${id}`, { privileged: true, method: 'DELETE' }), 'Cleanup fixture account');
    console.log('Fixture cleanup complete.');
  } catch {
    failure = true;
    console.error(`FAIL: fixture cleanup incomplete. Inspect LOCAL FAS records with run label ${run}.`);
  }
}
console.log(`${passed} API security groups passed; full suite ${failure ? 'FAILED' : 'PASSED'}.`);
process.exitCode = failure ? 1 : 0;
