// Prepares reviewed SQL only. Never contacts a service, publishes or applies SQL.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPolicyHistory } from './fas-policy-history.mjs';

export function policyReleasePlan(root, registry) {
  verifyPolicyHistory(root, registry);
  const version = registry.candidateVersion;
  const entry = registry.versions[version];
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(version ?? '') ||
      !['publication-candidate', 'published'].includes(entry?.status) ||
      entry.acknowledgementKind !== 'published_terms_agreement') throw Error('A frozen release candidate is required.');
  for (const kind of ['terms', 'privacy']) {
    if (entry.documents[kind]?.path !== `/account/policy-history/${version}/${kind}/index.html` ||
        !/^[a-f0-9]{64}$/.test(entry.documents[kind]?.sha256 ?? '')) throw Error('Exact frozen paths and hashes are required.');
  }
  const terms = entry.documents.terms.sha256;
  const privacy = entry.documents.privacy.sha256;
  // All inserted text is restricted above to identifiers, hashes and fixed paths.
  return `-- PREPARED ONLY: execute after explicit publication approval and verification
-- of the exact public snapshot bytes on https://fromastoryteller.com.
-- Keep Auth signup OFF throughout this transaction. No user agreement is inserted.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';
do $fas_release$
declare current_required text;
begin
  select release_id into current_required from private.account_policy_requirement
    where singleton for update;
  if not found then raise exception 'Policy requirement singleton is missing'; end if;
  if current_required is not null and current_required <> '${version}' then
    raise exception 'Another policy release is required; review a separate transition';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='${version}') then
    insert into private.account_policy_releases
      (release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age)
    values ('${version}','published',now(),'${version}','${version}',
      '${terms}','${privacy}',
      '/account/policy-history/${version}/terms/',
      '/account/policy-history/${version}/privacy/',16);
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='${version}'
    and status='published' and published_at<=now()
    and terms_version='${version}' and privacy_version='${version}'
    and terms_sha256='${terms}' and privacy_sha256='${privacy}'
    and terms_path='/account/policy-history/${version}/terms/'
    and privacy_path='/account/policy-history/${version}/privacy/' and minimum_age=16) then
    raise exception 'Stored release differs from the reviewed snapshots';
  end if;
  update private.account_policy_requirement set release_id='${version}' where singleton;
end $fas_release$;
commit;
`;
}

// A later release must name and verify the exact predecessor. This cannot be
// used as a bootstrap, skip another release, rewrite history or invent consent.
export function policyTransitionPlan(root, registry, version, previousVersion) {
  if (version === previousVersion || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(previousVersion ?? '')) throw Error('A distinct reviewed predecessor is required.');
  const previous = registry.versions[previousVersion];
  if (previous?.status !== 'published' || registry.versions[version]?.previousVersion !== previousVersion) throw Error('The published predecessor must match the candidate.');
  const sql = policyReleasePlan(root, { ...registry, candidateVersion: version });
  const guard = `  if current_required is not null and current_required <> '${version}' then`;
  const replacement = `  if current_required is null or current_required not in ('${previousVersion}','${version}') then`;
  const verifyPrevious = `  if not exists(select 1 from private.account_policy_releases where release_id='${previousVersion}'
    and status='published' and published_at<=now()
    and terms_sha256='${previous.documents.terms.sha256}'
    and privacy_sha256='${previous.documents.privacy.sha256}') then
    raise exception 'Published predecessor does not match the reviewed history';
  end if;
`;
  return sql.replace('-- Keep Auth signup OFF throughout this transaction. No user agreement is inserted.',"-- Existing signup and agreement requests carry exact versions/hashes;\n-- stale requests fail closed during this locked transition. No user agreement is inserted.").replace(guard,replacement).replace(`  if not exists(select 1 from private.account_policy_releases where release_id='${version}') then`,verifyPrevious + `  if not exists(select 1 from private.account_policy_releases where release_id='${version}') then`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--write') throw Error('Use --write to prepare SQL only.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const registry = JSON.parse(readFileSync(new URL('../account/policy-versions.json', import.meta.url), 'utf8'));
  const sql = policyReleasePlan(root, registry);
  writeFileSync(new URL(`../supabase/ops/${registry.candidateVersion}.sql`, import.meta.url), sql);
  console.log('Prepared reviewed release SQL; no service contacted or setting changed.');
}
