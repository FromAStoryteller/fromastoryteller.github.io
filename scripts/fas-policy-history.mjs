import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
export const policyDigest = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const main = html => html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0];

export function verifyPolicyHistory(root, registry) {
  const accountRoot = resolve(root, 'account');
  const read = path => {
    const resolved = resolve(root, path.replace(/^\//, ''));
    if (!resolved.startsWith(accountRoot + sep)) throw new Error('Policy paths must stay in account/.');
    return readFileSync(resolved, 'utf8');
  };
  for (const [version, entry] of Object.entries(registry.versions)) {
    if (entry.status === 'review') continue;
    for (const [kind, document] of Object.entries(entry.documents)) {
      if (policyDigest(read(document.path)) !== document.sha256) throw new Error(`Preserved ${version} ${kind} changed; create a new version.`);
      if (document.source) {
        const body = main(read(document.source));
        if (!body || policyDigest(body) !== document.mainSha256) throw new Error(`Acknowledged ${version} ${kind} wording changed; create a new version.`);
      }
    }
  }
}

// Operator release-readiness check only. This does not enable Auth or replace
// server-side agreement enforcement at a later deliberate production rollout.
export function publishedAgreement(registry) {
  const entry = registry.versions[registry.activePublishedVersion];
  if (!entry || entry.status !== 'published' || entry.acknowledgementKind !== 'published_terms_agreement') throw new Error('No published account agreement is approved. Test drafts cannot be used as live agreement.');
  for (const kind of ['terms', 'privacy']) {
    if (!entry.documents[kind]?.path || !/^[a-f0-9]{64}$/.test(entry.documents[kind]?.sha256 ?? '')) throw new Error('Published policy snapshots and checksums are required.');
  }
  return entry;
}
