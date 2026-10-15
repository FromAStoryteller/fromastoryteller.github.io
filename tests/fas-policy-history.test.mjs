import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyPolicyHistory, publishedAgreement, policyDigest } from '../scripts/fas-policy-history.mjs';
import { REGISTRATION_VERSION } from '../account/registration-declaration.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const registry = JSON.parse(readFileSync(new URL('../account/policy-versions.json', import.meta.url), 'utf8'));
test('Acknowledged draft remains preserved while revised wording is reviewed separately', () => {
  assert.doesNotThrow(() => verifyPolicyHistory(root, registry));
  assert.equal(registry.versions[REGISTRATION_VERSION].acknowledgementKind, 'local_draft_review');
  assert.equal(registry.versions[registry.reviewVersion].status, 'review');
  assert.notEqual(REGISTRATION_VERSION, registry.reviewVersion);
  const signup = readFileSync(new URL('../account/sign-up/index.html',import.meta.url),'utf8');
  assert.ok(signup.includes('/account/privacy-preview/') && signup.includes('/account/terms-preview/'));
});
test('Changed history or acknowledged wording fails verification, independent of line endings', () => {
  const changed = structuredClone(registry);
  changed.versions[REGISTRATION_VERSION].documents.terms.sha256 = '0'.repeat(64);
  assert.throws(() => verifyPolicyHistory(root, changed), /Preserved/);
  changed.versions[REGISTRATION_VERSION].documents.terms.sha256 = registry.versions[REGISTRATION_VERSION].documents.terms.sha256;
  changed.versions[REGISTRATION_VERSION].documents.terms.mainSha256 = '0'.repeat(64);
  assert.throws(() => verifyPolicyHistory(root, changed), /Acknowledged/);
  assert.equal(policyDigest('a\r\nb'),policyDigest('a\nb'));
});
test('Draft versions cannot pass the published agreement readiness check', () => {
  assert.throws(() => publishedAgreement(registry), /No published/);
  for (const activePublishedVersion of [REGISTRATION_VERSION,registry.reviewVersion]) assert.throws(() => publishedAgreement({...registry,activePublishedVersion}), /No published/);
  const incomplete=structuredClone(registry);
  incomplete.activePublishedVersion=registry.reviewVersion;
  Object.assign(incomplete.versions[registry.reviewVersion],{status:'published',acknowledgementKind:'published_terms_agreement'});
  assert.throws(()=>publishedAgreement(incomplete),/snapshots and checksums/);
});
