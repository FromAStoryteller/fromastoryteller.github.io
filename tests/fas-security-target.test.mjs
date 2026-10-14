import test from 'node:test';
import assert from 'node:assert/strict';
import { securityTarget, checkLegacyProjectKey, FAS_DEV_REF } from '../scripts/fas-security-target.mjs';
test('default security target requires explicit local acknowledgement', () => {
  assert.throws(() => securityTarget([], undefined));
  assert.equal(securityTarget([], 'fas-community-v1').base, 'http://127.0.0.1:55321');
});
test('hosted security tests only accept the exact FAS development reference', () => {
  assert.throws(() => securityTarget(['--hosted-dev'], 'fas-community-v1'));
  assert.throws(() => securityTarget(['--hosted-dev'], 'fas-community-prod'));
  assert.equal(securityTarget(['--hosted-dev'], `fas-community-dev:${FAS_DEV_REF}`).base, `https://${FAS_DEV_REF}.supabase.co`);
});
test('arbitrary URLs, refs and extra arguments cannot select a security test target', () => {
  for (const args of [['--url=https://example.com'], ['--hosted-dev','--project-ref=other'], ['--production']]) {
    assert.throws(() => securityTarget(args, `fas-community-dev:${FAS_DEV_REF}`));
  }
});
test('hosted legacy keys must match both expected role and development project', () => {
  const fakeKey = (role, ref) => `header.${Buffer.from(JSON.stringify({role,ref})).toString('base64url')}.signature`;
  assert.doesNotThrow(() => checkLegacyProjectKey(fakeKey('anon', FAS_DEV_REF), 'anon'));
  assert.throws(() => checkLegacyProjectKey(fakeKey('service_role', FAS_DEV_REF), 'anon'));
  assert.throws(() => checkLegacyProjectKey(fakeKey('anon', 'production'), 'anon'));
});
