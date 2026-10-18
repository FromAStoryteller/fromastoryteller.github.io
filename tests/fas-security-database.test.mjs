import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { policyReleasePlan, policyTransitionPlan } from '../scripts/fas-policy-release-plan.mjs';

test('FAS migrations enforce SQL permissions, workflows and image approval', async () => {
  const db = new PGlite();
  try {
    // Real PostgreSQL engine with minimal Supabase-managed schema stand-ins.
    // This verifies SQL/RLS, not Auth sessions, Storage bytes or HTTP behavior.
    await db.exec(`
      create role supabase_auth_admin; create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}'::jsonb);
      create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id) on delete cascade, not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, storage to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text references storage.buckets(id), name text, metadata jsonb default '{}'::jsonb, updated_at timestamptz default now());
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
    `);
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
      // Rehearse the original installed workflow here. The complete upgraded
      // Studio publication contract has its own database suite.
      if (file.endsWith('_image_service_access.sql') || file.endsWith('_image_storage_uploads.sql') || file.endsWith('_image_cleanup_schedule.sql') || file.endsWith('_story_public_listing.sql') || file.endsWith('_story_publishing_lifecycle.sql') || file.endsWith('_contributor_permissions.sql') || file.endsWith('_separate_admin_tools.sql') || file.endsWith('_admin_image_session_guard.sql') || file.endsWith('_admin_account_directory.sql') || file.endsWith('_retire_moderator_contributor_removal.sql') || file.endsWith('_storyteller_studio_publishing.sql') || file.endsWith('_studio_reporting_foundation.sql') || file.endsWith('_studio_catalogs_and_metadata_versions.sql') || file.endsWith('_studio_warning_request_retention.sql') || file.endsWith('_studio_unique_content_addresses.sql') || file.endsWith('_studio_self_service_addresses.sql') || file.endsWith('_publishing_identity_and_legacy_ownership.sql')) continue;
      await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
    }
    for (const file of ['access.sql', 'security.sql', 'lifecycle.sql', 'registration.sql', 'policy-agreements.sql', 'policy-contributions.sql']) {
      await db.exec(readFileSync(new URL(`../supabase/tests/${file}`, import.meta.url), 'utf8'));
    }
    // Rehearse the old installed workflow, then verify the additive self-publishing upgrade.
    const contributorMigration = readdirSync(migrations).find(f => f.endsWith('_contributor_permissions.sql'));
    assert.ok(contributorMigration, 'Contributor permissions migration must be committed');
    await db.exec(readFileSync(new URL(contributorMigration, migrations), 'utf8'));
    await db.exec(readFileSync(new URL('../supabase/tests/contributor-permissions.sql', import.meta.url), 'utf8'));
    const registry=JSON.parse(readFileSync(new URL('../account/policy-versions.json',import.meta.url),'utf8'));
    const sql=policyReleasePlan(fileURLToPath(new URL('../',import.meta.url)),registry);
    assert.equal(readFileSync(new URL(`../supabase/ops/${registry.candidateVersion}.sql`,import.meta.url),'utf8').replace(/\r\n/g,'\n'),sql);
    await db.exec(sql);
    const state=async()=> (await db.query(`select release_id,published_at::text from private.account_policy_releases order by release_id`)).rows;
    const first=await state();
    assert.equal(first.length,1);
    await db.exec(sql);
    assert.deepEqual(await state(),first,'Retry must preserve the original publication timestamp');
    assert.equal((await db.query('select count(*)::int as n from private.account_policy_agreements')).rows[0].n,0,'Release preparation must not invent account agreements');
    const hash=registry.versions[registry.candidateVersion].documents.terms.sha256;
    await assert.rejects(db.exec(sql.replaceAll(hash,'f'.repeat(64))),/Stored release differs/);
    await db.exec('rollback');
    assert.deepEqual(await state(),first);
    const version=registry.sessionUpdateVersion;
    const transition=policyTransitionPlan(fileURLToPath(new URL('../',import.meta.url)),registry,version,registry.candidateVersion);
    assert.equal(readFileSync(new URL(`../supabase/ops/${version}.sql`,import.meta.url),'utf8').replace(/\r\n/g,'\n'),transition);
    await db.exec(transition);
    const transitioned=await state();assert.equal(transitioned.length,2);
    assert.equal((await db.query('select release_id from private.account_policy_requirement')).rows[0].release_id,version);
    await db.exec(transition);assert.deepEqual(await state(),transitioned);
    assert.equal((await db.query('select count(*)::int as n from private.account_policy_agreements')).rows[0].n,0);
    const previousHash=registry.versions[registry.candidateVersion].documents.privacy.sha256;
    await assert.rejects(db.exec(transition.replaceAll(previousHash,'d'.repeat(64))),/Published predecessor does not match/);
    await db.exec('rollback');
    await db.exec(`update private.account_policy_requirement set release_id='${registry.candidateVersion}';`);
    const newHash=registry.versions[version].documents.privacy.sha256;
    await assert.rejects(db.exec(transition.replaceAll(newHash,'e'.repeat(64))),/Stored release differs/);
    await db.exec('rollback');
    await db.exec('update private.account_policy_requirement set release_id=null;');
    await assert.rejects(db.exec(transition),/Another policy release/);
    await db.exec('rollback');
    await db.exec(`update private.account_policy_requirement set release_id='${registry.candidateVersion}';`);
    await db.exec(`insert into private.account_policy_releases select 'other-reviewed-release',status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age from private.account_policy_releases where release_id='${registry.candidateVersion}';
      update private.account_policy_requirement set release_id='other-reviewed-release';`);
    await assert.rejects(db.exec(sql),/Another policy release/);
    await db.exec('rollback');
    assert.equal((await db.query('select release_id from private.account_policy_requirement')).rows[0].release_id,'other-reviewed-release');
  } finally { await db.close(); }
});
