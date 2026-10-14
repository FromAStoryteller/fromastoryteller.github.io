# FAS Community V1: database and storage security

Prepared 15 October 2026 against `FromAStoryteller/fromastoryteller.github.io`
main commit `6b0aa72`. This is an additive change to the three existing migrations;
none of those applied files are rewritten. Production has not been changed.
Play My Path is outside this work: no shared project, bucket, accounts or keys.

## 1. Understand the permissions

RLS is the database's door check. Hiding buttons is useful, but someone can send
requests without your website. The database and image service must reject them.

| Person | Story access | Changes | Images |
| --- | --- | --- | --- |
| Anonymous visitor | Published stories | None | Approved images on published stories |
| Viewer: signed in, no community role | Published stories; own profile | Own display name/bio | Same public images |
| Contributor: existing database role `member` | Published stories and their own drafts/rejections/submissions/archive | Own draft/rejection edits and submission | Upload/register own draft/rejection images; read own registered images |
| Moderator: existing staff role | All stories | Review via RPC with an audit reason; own contributor actions | Inspect and explicitly approve registered uploads |
| Admin | All stories; roles and moderation history | Same review workflow plus create/revoke invites | Same image review permissions |

Staff do not get a browser permission to rewrite another author's text or change
roles. Only a trusted operator may grant/revoke roles through SQL Editor/server
administration. `member` remains the existing contributor role, so current members
and accepted invites do not need a role conversion. Editable Auth metadata such
as `role=admin` never grants community permissions. New accounts remain viewers.
Owners retain read access to their own records if their contributor role is removed;
removing a role stops contribution and staff actions immediately.

## 2. What changed, and why

1. `20261015000100_security_hardening.sql` adds image approval timestamps and the
   reviewing staff account. `approve_story_image(target_asset)` checks the caller's
   database role and that the registered object exists. A changed description
   clears approval. Contributors cannot write approval columns directly.
2. Public image metadata and downloads require both a published story and an
   approved image. Existing images start unapproved: staff must inspect and approve
   any that should remain publicly readable after the migration. Publishing text
   can proceed while an unapproved image stays hidden. No destructive conversion
   or automatic approval is performed.
3. Restrictive story/storage policies provide additional checks alongside the
   original policies. Even a later broad Storage policy cannot expose FAS draft
   images, allow unauthorized uploads, or enable replacement/move/deletion. Other
   buckets are unaffected by these FAS gates. Keep all existing ownership and
   workflow policies; these extra gates are not a substitute for them.
4. PUBLIC table grants are revoked. Client roles still have narrowly chosen column
   grants, RLS and immutable-identity triggers. Role writes and browser deletion
   stay blocked; publication/archive still use the audited moderation RPC.
5. Local `auto_expose_new_tables=false` requires explicit grants for future tables.
   This config does not change a hosted project's settings. Review every future
   table/function migration for RLS and grants as well.
6. `audit-security.sql` is a read-only permission inventory; `security.sql` adds
   transactional database checks; the API runner tests real Auth, Data API and
   Storage requests without going through the website.

The application is currently a static website. It has no Supabase community
client, server routes or Edge Functions to update. Existing file-based stories
are not imported into the community database by this patch. The future client
must use a publishable/anon key and the user's session, and request protected
downloads or short-lived signed URLs. Never put a service key in browser code.
Approve images only after staff inspect them. MIME/extension/size checks are not
image-content validation; server-side decoding/re-encoding is still a launch task.
An already fetched image URL can be served from hosted CDN cache after archival,
even though a fresh origin request is denied. A short signed URL lifetime alone
does not guarantee that its cached response stops being served at expiry. See
[hosted-api-security.md](hosted-api-security.md) before production rollout.
Downloaded bytes cannot be recalled.

## 3. Check the prepared change locally

Open PowerShell in the FAS repository containing these files. Install dependencies
and run the normal tests:

```powershell
npm.cmd ci
npm.cmd test
```

The PostgreSQL test uses PGlite with minimal stand-ins for Supabase's managed Auth
and Storage tables. It executes the actual migrations, grants, triggers and RLS,
including an intentionally broad Storage policy to check the restrictive gates.
It does not prove hosted configuration, real login or image-service behavior.

Start Docker Desktop with its Linux engine working, then start the separate local
FAS stack. First back up anything valuable in your local FAS database. Starting
the stack does not apply a newly added migration to an already-running database.

```powershell
npx.cmd --yes supabase@2.120.0 start
npx.cmd --yes supabase@2.120.0 migration up --local
npx.cmd --yes supabase@2.120.0 db lint --local --level warning
```

Use `db reset --local` only if you intentionally want to erase disposable LOCAL FAS
data and replay all migrations. Never use a production connection with these tests.
Run both SQL fixture files against the identified local FAS container:

```powershell
Get-Content -Raw supabase/tests/access.sql | docker exec -i supabase_db_fas-community-v1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -
Get-Content -Raw supabase/tests/security.sql | docker exec -i supabase_db_fas-community-v1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -
```

Both must exit successfully; any ERROR is a failed test. Fixtures roll back.

## 4. Run the direct API tests

By default the runner targets `http://127.0.0.1:55321`. It checks the FAS project config
and needs explicit acknowledgement. It never reads `.env.local` or a hosted link.
It creates random synthetic accounts, signs each in, assigns fixture roles using
the LOCAL service key, then tests permissions using anon or individual user tokens.
The service key is used only to create/clean fixtures, never for permission checks.
The suite signs out its fixture sessions and removes only its recorded
accounts/stories/images/invites afterwards. Hosted mode requires a separate exact
development acknowledgement and accepts only the hardcoded FAS development
reference; see [hosted-api-security.md](hosted-api-security.md).
If the process is interrupted, inspect the local synthetic records before retrying.

Load keys from the LOCAL CLI status into the current terminal, without displaying
or copying them into files or chat:

```powershell
$fasLocalStatus = npx.cmd --yes supabase@2.120.0 status -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Local FAS status failed' }
if ($fasLocalStatus.API_URL -ne 'http://127.0.0.1:55321') { throw 'Expected LOCAL FAS URL' }
$env:FAS_TEST_ANON_KEY = $fasLocalStatus.ANON_KEY
$env:FAS_TEST_SERVICE_KEY = $fasLocalStatus.SERVICE_ROLE_KEY
$env:FAS_TEST_CONFIRM = 'fas-community-v1'
try { npm.cmd run test:security:api; if ($LASTEXITCODE -ne 0) { throw 'API security tests failed' } }
finally {
  Remove-Item Env:FAS_TEST_ANON_KEY,Env:FAS_TEST_SERVICE_KEY,Env:FAS_TEST_CONFIRM -ErrorAction SilentlyContinue
  Remove-Variable fasLocalStatus -ErrorAction SilentlyContinue
}
```

Expected: seven PASS groups and `full suite PASSED`, with fixture cleanup complete.
Do not replace the local command's keys with hosted keys; never save the status JSON. If a CLI
version uses different field names, check its documentation rather than printing
its full key-bearing output. API failures suppress response bodies/credentials.
Check the last successful PASS group, local service status and migration history.

The suite checks draft text/metadata/bytes/listing/signed URLs; reader creation;
cross-author edits and ownership changes; role upserts/updates/deletes and metadata
spoofing; privileged RPC denial; image path/MIME/size restrictions; approval and
description changes; overwrite/upsert/move/delete denial; published reads; archival
and audit integrity; wrong-email, expired, revoked and reused invites. It cannot
prove future HTML rendering, SMTP, a finished UI, content validation or production.

## 5. What you must do in Supabase

1. After local tests pass, select **FAS development** in the Dashboard. Run the
   read-only `supabase/tests/audit-security.sql` in SQL Editor. Confirm all six
   tables have RLS, the bucket is private and limited to JPEG/PNG/WebP and 5 MiB,
   and all privilege flags in its fourth result are false. Investigate any extra
   policies/functions or unexpected grants; this checkout cannot verify drift
   in an uninspected hosted database.
2. In the checkout explicitly linked to FAS development, check the project and
   migration history, then inspect `db push --linked --dry-run`. For an existing
   foundation it should list only `20261015000100_security_hardening.sql`. Apply
   that reviewed migration to dev and rerun the read-only audit. Follow the
   existing setup guide for project identity checks. Do not apply fixtures to a
   hosted database. Use the explicit hosted-dev harness described in
   [hosted-api-security.md](hosted-api-security.md) for hosted service checks.
3. For dev images that should be public, sign in as admin/moderator in a trusted
   test client and call `approve_story_image` with the asset ID after inspection.
   The browser RPC derives the staff identity from the session. SQL Editor is a
   trusted operator context, not a browser session; simply calling the RPC there
   does not establish a staff identity. Leave unapproved images private.
4. Keep production unchanged until dev review and verification are complete.
   Later, use the documented backup and deliberate production migration process.
   Recheck grants/policies and image approvals in that project separately.

## Verification recorded for this preparation

The normal test suite, including actual PostgreSQL migration/RLS tests, passed
with 18 tests. Docker was subsequently restored: the new migration was applied
to the verified local FAS database, both transactional SQL suites passed against
real Supabase PostgreSQL, and Supabase lint found no schema errors. After Docker
Desktop was restarted, all seven real Auth/Data API/Storage security groups passed.
Fixture cleanup completed; follow-up queries confirmed zero remaining synthetic
test accounts, stories or assets.

Hosted `fas-community-dev` was then inspected through its Dashboard: the original
policies/functions matched the expected foundation, all six tables had RLS, the
image bucket was private with the intended MIME/size limits, protected client
privileges were denied, and no community stories/assets were present. An explicit
development-project dry run listed only the new migration. That migration was
applied using the CLI (without seeds, custom roles or Vault updates). A second
dry run reported up to date, and all ten Dashboard post-migration checks passed.
Production and Play My Path were not inspected or changed during this rollout.

Hosted security advisors returned no errors and six warnings: five authenticated
SECURITY DEFINER workflow functions and disabled leaked-password protection.
The five functions intentionally perform privileged operations after checking
the caller's database role or a matching verified email and active invitation;
anonymous execution is revoked. Their denial paths passed the local API suite.
The Auth warning is separate from RLS: leaked-password protection requires Pro or
above per [Supabase's password documentation](https://supabase.com/docs/guides/auth/password-security).
No plan upgrade or Auth setting change was made. Review that warning before launch.
Hosted development API tests were subsequently run. All seven origin-permission
groups passed, but cached image revocation failed: previously fetched URLs could
return cached bytes after archival. The full suite correctly exits nonzero.
Cleanup was verified and the one pre-existing development image was preserved.
Production review/backup/migration and server image-content validation remain
outside the completed checks. Do not treat the caching result as a launch sign-off.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Storage bucket privacy](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[function permissions](https://supabase.com/docs/guides/database/functions).
