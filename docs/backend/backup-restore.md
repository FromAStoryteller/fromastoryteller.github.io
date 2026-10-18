# FAS backup and restore

Current operational closeout and exact next backup location: [Community operational readiness](community-operational-readiness.md). The last confirmed encrypted set predates the latest releases. Do not run the historical generic import example below against current account-enabled backups; use an isolated target-specific plan first.

Database backups alone do not contain uploaded image bytes. Keep three things:
the reviewed repository/migrations, confidential database exports, and image files
with a checksum inventory. Hosted Auth/SMTP/redirect settings and secrets require
a separate secure operational record; Git is not their backup.

Current operating choice (14 October 2026): Ryan runs backups manually. Export
production weekly and before database changes; export development before significant
changes. Export locally outside Dropbox, encrypt the complete set as a 7z archive
with AES-256 and encrypted file names, test it with the saved password, then copy
the dated archive into Dropbox's `02 From A Storyteller/02 Website/Backups/FAS-Backups`.
Store the password separately. Remove unencrypted working exports only after
verification and confirmation that the encrypted archive has synced.

Dropbox sync does not create fresh database exports, and no backup scheduler is
installed. A weekly schedule can lose up to a week's changes between snapshots;
reassess frequency before real community use. The updated account policy limits
deleted personal data in restricted backups to 30 days. Ryan will remove or replace
manual archives within that limit; do not retain older monthly sets containing
deleted data. Retention pruning is not automated. Rehearse recovery periodically and before relying
on a changed procedure; measure recovery time rather than promising it. Check
the project's actual backup plan/retention in Database -> Backups. Free-tier
projects need regular exports, including separate Storage bytes.

## 1. Freeze writes and identify the source

Use the FAS production checkout. Check the Dashboard project name/reference and
`npx --yes supabase@2.120.0 projects list`. Link explicitly to the intended FAS
project and inspect `migration list --linked`. Never select PMP.
Pause community writes, moderation and uploads during a backup so database rows
and image bytes form one consistent set. Before a community UI exists, make no
operator writes during the export. Record the source project ref, time, Git commit,
CLI version, PostgreSQL version and migration list in a private backup note.

Choose a private directory outside the repository and any website publish folders.
For example create a dated folder using File Explorer on an encrypted drive.
In PowerShell set its path (change the example to your actual private path):

```powershell
$fasBackup = 'D:\Private-FAS-Backups\2026-10-14'
New-Item -ItemType Directory -Force -Path $fasBackup
npx --yes supabase@2.120.0 link --project-ref YOUR_FAS_SOURCE_PROJECT_REF
npx --yes supabase@2.120.0 migration list --linked
npx --yes supabase@2.120.0 db dump --linked --role-only -f "$fasBackup\roles.sql"
npx --yes supabase@2.120.0 db dump --linked --schema public,private -f "$fasBackup\schema.sql"
npx --yes supabase@2.120.0 db dump --linked --data-only --use-copy --schema public,private,auth -f "$fasBackup\data.sql"
npx --yes supabase@2.120.0 db dump --linked --schema supabase_migrations -f "$fasBackup\history-schema.sql"
npx --yes supabase@2.120.0 db dump --linked --data-only --use-copy --schema supabase_migrations -f "$fasBackup\history-data.sql"
```

Docker must be running for CLI dumps. Every command must succeed. Files can
contain personal information and Auth password hashes: encrypt/restrict them.
Keep the exact Git commit/migrations with the set. Schema/roles/history files are
audit snapshots for this V1 restore method; the restore below rebuilds the schema
and migration history by replaying the exact migrations, then imports data.
Do not combine this method with importing schema/history again.

The data export deliberately excludes Storage metadata: the migrations recreate
the bucket and the Storage API recreates object records when image bytes are
uploaded. Application `story_assets` rows are included and retain their paths.
Do not copy raw `storage.objects` rows without bytes: that creates broken files.

## 2. Export all FAS images

The supplied operator tool exports every object in `fas-story-images`, including
orphaned uploads. It paginates folders and records paths, sizes, MIME types and
SHA-256 hashes. It never changes the source bucket. Use the source project's URL
and a secret/service_role API key from that project's API settings. The secret is
entered at a masked prompt and stays in this terminal's environment only:

```powershell
$env:FAS_STORAGE_URL = 'https://YOUR_FAS_SOURCE_PROJECT_REF.supabase.co'
$env:FAS_STORAGE_SECRET_KEY = [System.Net.NetworkCredential]::new('', (Read-Host 'FAS source secret key' -AsSecureString)).Password
node scripts/fas-storage-backup.mjs export "$fasBackup\images"
Remove-Item Env:FAS_STORAGE_SECRET_KEY
Remove-Item Env:FAS_STORAGE_URL
```

If a command fails, remove those environment variables anyway, investigate and
use a new empty image export directory for the retry. Never print or commit keys.
Expected result: `Exported N files with SHA-256 inventory`. Check
`images/manifest.json` against a source inventory in SQL Editor:

```sql
select name from storage.objects
where bucket_id = 'fas-story-images' order by name;
select count(*) as image_count from storage.objects
where bucket_id = 'fas-story-images';
```

Save row counts of profiles, user_roles, stories, story_assets, moderation_log,
invites and auth.users privately. Also record the bucket's private flag, 5 MiB
limit and allowed MIME types. If any files are missing, keep writes paused until
the backup set is complete. Hash the SQL files with `Get-FileHash -Algorithm SHA256`
and record the results privately. Encrypt/copy the whole set off-site, then resume
writes. An untested export is not evidence that recovery will work.

## 3. Restore drill into a new disposable FAS project

**Account-enabled backups require an adapted import plan.** The generic single-file
import below describes the earlier security baseline, not a rehearsed import of
all account tables. New migrations seed singleton configuration rows, so importing
their saved rows blindly can conflict. Preserve the newest deletion ledger outside
the older backup and install/replay it before reopening access. Include original
registration declarations, policy releases, agreements, their times/checksums and
published document snapshots. Keep the policy requirement NULL during Auth import,
restore original agreement rows without inventing acceptance, then restore the
reviewed requirement last. Resolve seeded singleton rows explicitly. The successful
local rehearsal uses ordered inserts and real Storage APIs; it does not certify a
full hosted SQL dump import. See local-restore-rehearsal.md before preparing one.

Never overwrite production as a rehearsal. Create `fas-community-restore-test`
in Supabase. Keep signups disabled and SMTP delivery off so restored users receive
no mail. Do not connect the public website. Use a compatible Supabase/Postgres
version; Auth managed schema compatibility matters as well as the major version.

1. Clone/check out the exact repository commit recorded with the backup in a
   separate folder. Link it explicitly to the empty restore-test project.
2. Review `db push --linked --dry-run`, then `db push --linked`. This recreates
   tables, types, functions, Auth profile trigger, RLS, private storage bucket and
   policies. It also records migration history. Do not load schema.sql/roles.sql
   over this fresh migration-created schema. If this project has data already,
   create another fresh target rather than guessing what to delete.
3. Install PostgreSQL client tools including `psql` for Windows, if missing.
   In the target Dashboard click Connect; choose the Session pooler host/port
   when direct IPv6 connectivity is unavailable. Copy host, port, database and
   username separately. Use the target password via `-W` prompt, not in a URL or
   command history. Replace placeholders below:

The earlier single-file import command is intentionally omitted: it is not a current account-enabled restore plan. Prepare and rehearse a transaction against the fresh isolated target that reconciles seeded singleton/configuration rows, managed Auth compatibility and cyclic story/cover references before importing. Preserve original declarations/agreements and replay the newest deletion ledger before reopening access. A failed import must roll back; do not bypass constraints or ignore errors to continue. Do not import schema/history twice.

4. Restore bytes to the target's empty private bucket using the target URL/key:

```powershell
$env:FAS_STORAGE_URL = 'https://YOUR_RESTORE_PROJECT_REF.supabase.co'
$env:FAS_RESTORE_CONFIRM_URL = $env:FAS_STORAGE_URL
$env:FAS_STORAGE_SECRET_KEY = [System.Net.NetworkCredential]::new('', (Read-Host 'Restore-test secret key' -AsSecureString)).Password
node scripts/fas-storage-backup.mjs restore "$fasBackup\images"
node scripts/fas-storage-backup.mjs export "$fasBackup\restore-verification-images"
Remove-Item Env:FAS_STORAGE_SECRET_KEY
Remove-Item Env:FAS_STORAGE_URL
Remove-Item Env:FAS_RESTORE_CONFIRM_URL
```

Restore refuses overwrites and validates all local checksums before uploading.
If it stops partway, some objects may already have uploaded. Use a fresh target
or inspect carefully before resuming; do not enable overwrites as a shortcut.
Compare the original and verification manifests by `name`, `bytes`, and `sha256`
(file numbers, source URLs and timestamps will differ). All hashes must match.

5. Compare saved table row counts, roles, story states and moderation records.
   Check that `auth.users` identities match `profiles.id`, and every registered
   image path is present. Recheck private bucket limits, RLS and the Auth trigger.
6. With disposable test accounts added through Auth, verify sign-in, draft
   privacy, role protection, image access and moderation via the future client.
   Confirm visitors cannot see drafts. Use a fresh-account smoke test to confirm
   the profile trigger still fires. Do not run the local rollback fixtures against
   restored personal production data or send mail to restored users.
7. Record elapsed recovery time, discrepancies and all verification outcomes.
   Only then call the backup set verified. Keep the target isolated, then remove
   the disposable restore project yourself when it is no longer needed.

For an actual incident, freeze production writes, take a current safety backup,
rehearse on a fresh target, then decide a supervised recovery/cutover. A new target
has different URLs/keys and hosted Auth settings; rotate secrets, update the future
frontend/server settings, and require users to sign in again as appropriate.
An in-place Dashboard restore can cause downtime and does not restore lost image
bytes; recover those from the separate storage set. No automatic prod restore or
cutover is included in this change.

Supabase's [backup guidance](https://supabase.com/docs/guides/platform/backups)
explains plan coverage and the exclusion of Storage bytes. Its
[CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
covers Auth data, migration history and custom managed-schema triggers/policies.
This V1 procedure restores those customizations from the exact migrations instead
of applying a generic schema dump on top of them. Revisit the procedure if future
migrations add Vault/encrypted columns, custom database login roles or other buckets.
