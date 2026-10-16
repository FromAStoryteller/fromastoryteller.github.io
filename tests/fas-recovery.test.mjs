import test from 'node:test';
import assert from 'node:assert/strict';
import { requestRecovery, consumeRecoveryLink, createRecoveryController } from '../account/recovery-controller.mjs';
const hash = 'a'.repeat(56);
test('Recovery requests hide account membership and report rate/network failures', async () => {
  const existing = await requestRecovery({ resetPasswordForEmail: async (email, options) => {
    assert.equal(email, 'reader@example.invalid');
    assert.equal(options.redirectTo, 'http://127.0.0.1:55400/account/reset-password/');
    return {};
  } }, ' reader@example.invalid ');
  assert.deepEqual(await requestRecovery({ resetPasswordForEmail: async () => ({ error: { status: 400, code: 'user_not_found' } }) }, 'missing@example.invalid'), existing);
  assert.equal((await requestRecovery({ resetPasswordForEmail: async () => ({ error: { status: 429 } }) }, 'reader@example.invalid')).state, 'error');
});
test('Recovery accepts only one recovery hash in the fragment and always scrubs credentials', () => {
  let scrubs = 0;
  for (const suffix of [`?token_hash=${hash}&type=recovery`, `#token_hash=${hash}&type=email`, '#verified=true', `#token_hash=${hash}&token_hash=${hash}&type=recovery`]) assert.equal(consumeRecoveryLink('http://127.0.0.1:55400/account/reset-password/' + suffix, () => scrubs++), null);
  assert.equal(consumeRecoveryLink(`http://127.0.0.1:55400/account/reset-password/#token_hash=${hash}&type=recovery`, () => scrubs++), hash);
  assert.equal(scrubs, 5);
});
test('Reset requires explicit server-verified recovery; checks passwords and revokes sessions after saving', async () => {
  const states = []; let writes = 0; let signouts = 0;
  const auth = {
    verifyOtp: async input => { assert.equal(input.type, 'recovery'); return { data: { session: {}, user: { id: 'reader' } } }; },
    getUser: async () => ({ data: { user: { id: 'reader' } } }),
    updateUser: async () => { writes++; return { data: { user: { id: 'reader' } } }; },
    signOut: async options => { assert.equal(options.scope, 'global'); signouts++; return {}; },
  };
  const c = createRecoveryController(auth, hash, s => states.push(s));
  await c.save('SampleOnly9!', 'SampleOnly9!'); assert.equal(writes, 0);
  await c.verify(); assert.equal(states.at(-1).state, 'ready');
  await c.save('bad', 'bad'); assert.equal(writes, 0);
  await c.save('SampleOnly9!', 'SampleOnly9!'); assert.equal(states.at(-1).state, 'saved');
  await c.save('SampleOnly9!', 'SampleOnly9!'); assert.equal(writes, 1); assert.equal(signouts, 1);
});
test('Invalid tokens and changed identity cannot update a password', async () => {
  let writes = 0; const states = [];
  const rejected = createRecoveryController({ verifyOtp: async () => ({ error: { status: 403 } }), updateUser: async () => { writes++; } }, hash, s => states.push(s));
  await rejected.verify(); await rejected.save('SampleOnly9!', 'SampleOnly9!'); assert.equal(writes, 0);
  const changed = createRecoveryController({ verifyOtp: async () => ({ data: { session: {}, user: { id: 'reader' } } }), getUser: async () => ({ data: { user: { id: 'other' } } }), updateUser: async () => { writes++; } }, hash, s => states.push(s));
  await changed.verify(); await changed.save('SampleOnly9!', 'SampleOnly9!'); assert.equal(writes, 0); assert.equal(states.at(-1).state, 'invalid');
});
