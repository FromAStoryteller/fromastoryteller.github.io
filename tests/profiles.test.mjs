import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile, createProfileService, renderAuthorAttribution, publicCoverUrl } from '../systems/community/profiles.mjs';
import { profileStoryCard } from '../systems/community/public-profile.mjs';

function fakeClient({ user = { id: 'current-user' }, data = { display_name: 'Alex', bio: '' }, error = null } = {}) {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'update']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.single = query.maybeSingle = async () => ({ data, error });
  return { calls, auth: { getUser: async () => ({ data: { user } }) }, rpc: async (name,args) => { calls.push(['rpc',name,args]); return {data,error}; }, from: table => { calls.push(['from', table]); return query; } };
}

test('field validation rejects privileged fields, blank names and excessive lengths', () => {
  assert.deepEqual(validateProfile({ display_name: ' Alex ', bio: ' hello ' }), { display_name: 'Alex', bio: 'hello', welcome_line: '' });
  for (const input of [null, [], { display_name: ' ', bio: '' }, { display_name: 'x'.repeat(81), bio: '' },
    { display_name: 'Alex', bio: 'x'.repeat(1001) }, { display_name: 'Alex', bio: '', role: 'admin' },
    { display_name: 'Alex', bio: '', id: 'another-user' }]) assert.throws(() => validateProfile(input));
  assert.equal(validateProfile({ display_name: '🌙'.repeat(80), bio: '' }).display_name.length, 160);
});

test('save derives ownership from authenticated user and returns only permitted fields', async () => {
  const client = fakeClient({ data: { display_name: 'Alex', bio: '', email: 'private@example.test', id: 'private' } });
  assert.deepEqual(await createProfileService(client).saveOwn({ display_name: 'Alex', bio: '' }), { display_name: 'Alex', bio: '', welcome_line: '', public_id: null });
  assert.ok(client.calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'id', 'current-user'])));
  assert.deepEqual(client.calls.find(call => call[0] === 'update')[1], { display_name: 'Alex', bio: '', welcome_line: '' });
});

test('signed-out requests never query profile data', async () => {
  const client = fakeClient({ user: null });
  await assert.rejects(createProfileService(client).readOwn(), /Sign in/);
  assert.equal(client.calls.length, 0);
});

test('viewer name-only updates preserve fields that are not on the viewer page', async () => {
  const client=fakeClient();
  await createProfileService(client).saveOwn({display_name:' New name '});
  assert.deepEqual(client.calls.find(call=>call[0]==='update')[1],{display_name:'New name'});
});

test('public cards reuse the shared artwork frame and never accept arbitrary cover hosts', () => {
  const asset_id='82000000-0000-0000-0000-000000000001';
  const base='https://oqmmvjjycpyxvxipcyli.supabase.co/functions/v1/fas-story-image';
  assert.equal(publicCoverUrl({asset_id},base),base+'?asset_id='+asset_id);
  assert.equal(publicCoverUrl({asset_id},'https://attacker.invalid/functions/v1/fas-story-image'),'');
  assert.equal(publicCoverUrl({asset_id},base+'?token=private'),'');
  assert.equal(publicCoverUrl({asset_id:'not-an-id'},base),'');
  const markup=profileStoryCard({slug:'a-story',title:'<img src=x>',summary:'A summary',cover:{asset_id,alt:'A coastline'}},{imageBase:base});
  assert.match(markup,/content-grid-card-link image-overlay/);
  assert.match(markup,/asset_id=82000000/);
  assert.match(markup,/alt="A coastline"/);
  assert.match(markup,/&lt;img src=x&gt;/);
  const missing=profileStoryCard({slug:'a-story',title:'A story',summary:'',preview_image:'/assets/images/stories/a-place-left-behind.jpg'});
  assert.match(missing,/content-grid-card-placeholder/);
  assert.doesNotMatch(missing,/<img /);
});

test('an account switch cannot save the previous account form into the next account', async () => {
  const client = fakeClient();
  const service = createProfileService(client);
  await service.readOwn();
  client.auth.getUser = async () => ({ data: { user: { id: 'different-user' } } });
  await assert.rejects(service.saveOwn({ display_name: 'Old account', bio: '' }), /account changed/);
  assert.equal(client.calls.filter(call => call[0] === 'update').length, 0);
});

test('zero-row and database errors do not report a saved profile or reveal raw errors', async () => {
  for (const response of [{ data: null }, { error: { message: 'sensitive database details' } }]) {
    await assert.rejects(createProfileService(fakeClient(response)).saveOwn({ display_name: 'Alex', bio: '' }), /could not be saved/);
  }
});

test('public byline requires published story and strips account fields', async () => {
  const client = fakeClient({ data: { author: { display_name: 'Alex', bio: 'Hello', email: 'private' } } });
  assert.deepEqual(await createProfileService(client).readPublishedAuthor('story'), { display_name: 'Alex', public_id: undefined });
  assert.ok(client.calls.some(call => call[0] === 'rpc' && call[1] === 'fas_public_story'));
  assert.equal(await createProfileService(fakeClient({ data: null })).readPublishedAuthor('draft'), null);
});

test('attribution treats markup as text and never falls back to email', () => {
  const element = { textContent: '', set innerHTML(_) { throw new Error('unsafe HTML'); } };
  renderAuthorAttribution(element, { display_name: '<img src=x onerror=alert(1)>' });
  assert.equal(element.textContent, 'By <img src=x onerror=alert(1)>');
  renderAuthorAttribution(element, { email: 'private@example.test' });
  assert.equal(element.textContent, 'Author unavailable');
});
