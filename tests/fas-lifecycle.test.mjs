import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLifecycleHandler } from '../supabase/functions/fas-account-lifecycle/handler.mjs';
import { confirmDeletion } from '../account/lifecycle-client.mjs';
const config = { base: 'http://127.0.0.1:55321', anonKey: 'local-anon', serviceKey: 'server-only', enabled: true };
function request(body, origin = 'http://127.0.0.1:55400') { return new Request('http://localhost/lifecycle', { method: 'POST', headers: { Authorization: 'Bearer synthetic.jwt.token', 'Content-Type': 'application/json', Origin: origin }, body }); }
test('Lifecycle stays off by default and rejects cross-origin, malformed and oversized requests before privileged access', async () => {
  let calls = 0; const noCalls = async () => { calls++; throw Error('Unexpected privileged access'); };
  assert.equal((await makeLifecycleHandler({ ...config, enabled: false }, noCalls)(request('{}'))).status, 404);
  const handler = makeLifecycleHandler(config, noCalls);
  assert.equal((await handler(request('{}', 'https://untrusted.invalid'))).status, 403);
  assert.equal((await handler(request('{broken'))).status, 400);
  assert.equal((await handler(request('x'.repeat(5000)))).status, 413);
  assert.equal(calls, 0);
});
test('A forged JWT payload cannot reach a privileged RPC without Auth verification', async () => {
  const calls = [];
  const handler = makeLifecycleHandler(config, async (url, options) => { calls.push({ url, options }); return new Response('{}', { status: 401 }); });
  assert.equal((await handler(request('{"action":"export","target_user":"someone-else"}'))).status, 401);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/auth\/v1\/user$/);
  assert.equal(calls[0].options.headers.apikey, 'local-anon');
  assert.notEqual(calls[0].options.headers.Authorization, 'Bearer server-only');
});
test('Receipt check can confirm completed deletion after the ordinary session is gone; pending never reports success', async () => {
  const original = globalThis.fetch;
  const local = { lifecycleEnabled: true, accountOrigin: 'http://127.0.0.1:55400', client: { supabaseUrl: 'http://127.0.0.1:55321', supabaseKey: 'local-anon', auth: { refreshSession: async () => ({ error: { status: 401 } }) } } };
  const prepared = { userId: '30000000-0000-0000-0000-000000000001', confirmationToken: 'a'.repeat(64) };
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer local-anon');
      assert.equal(JSON.parse(options.body).action, 'deletion-status');
      return Response.json({ state: 'complete' });
    };
    await assert.doesNotReject(() => confirmDeletion(local, prepared));
    globalThis.fetch = async () => Response.json({ state: 'pending' });
    await assert.rejects(() => confirmDeletion(local, prepared), /session has ended/);
    assert.equal(prepared.started, true);
  } finally { globalThis.fetch = original; }
});

test('A former contributor can export retained stories; an empty viewer cannot export content', async () => {
  const id = '30000000-0000-0000-0000-000000000001';
  const session = '30000000-0000-0000-0000-000000000002';
  const token = 'test.' + Buffer.from(JSON.stringify({ session_id: session })).toString('base64url') + '.test';
  let owned = true;
  const handler = makeLifecycleHandler(config, async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id, email: 'former@example.invalid', email_confirmed_at: '2026-01-01' });
    const args = JSON.parse(options.body);
    assert.equal(args.target_user, id);
    assert.equal(args.target_session, session);
    if (url.endsWith('/fas_claim_account_action')) return Response.json(true);
    assert.ok(url.endsWith('/fas_account_snapshot'));
    return Response.json({ fingerprint: 'stable', data: { role: 'viewer', profile: {}, assets: [], objects: [], stories: owned ? [{ id, slug: 'retained-story', title: 'Retained story', body: 'My original words', status: 'draft' }] : [] } });
  });
  const makeRequest = () => new Request('http://localhost/lifecycle', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:55400' }, body: JSON.stringify({ action: 'export', target_user: 'someone-else' }) });
  const response = await handler(makeRequest());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/zip');
  assert.match(new TextDecoder().decode(await response.arrayBuffer()), /My original words/);
  owned = false;
  assert.equal((await handler(makeRequest())).status, 403);
});
