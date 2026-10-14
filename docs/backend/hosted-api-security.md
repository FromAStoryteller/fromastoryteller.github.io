# Hosted FAS development API security checks

**Current status:** the security task is complete in hosted FAS development and
production. The full development suite passed again after the approved production
rollout. See [completion evidence](security-completion.md). The cache failure below
is the original finding, followed by its tested fix.

Target: **fas-community-dev**, `oqmmvjjycpyxvxipcyli`, only. Production and Play My
Path cannot be selected by this harness. No schema, bucket, Auth setting, SMTP,
DNS or production configuration is changed.

## Repeat the test

These tests create disposable synthetic accounts and content, briefly publish a
synthetic story/image, then archive it and clean up. Run only when that workflow
is authorized in FAS development. No emails are sent: fixture accounts are created
already confirmed through Auth's admin API, and FAS invites are database tokens.

1. In the connected Supabase project inventory, confirm the name and reference
   above. Confirm the security-hardening migration is applied. Preserve existing
   data; do not reset a hosted database. These fixtures use new random identifiers.
2. Open PowerShell in this FAS repository with Node and authenticated Supabase CLI
   access. Run:

```powershell
& ./scripts/test-fas-hosted-security.ps1
```

The script obtains a development publishable key and the legacy service-role key
directly from the CLI in memory. It does not print/store key output or use a
key-bearing command argument. The client key and individual fixture sessions run
the permission tests. The service key is used only for fixture setup/cleanup.
The Node runner requires both `--hosted-dev` and the exact acknowledgement
`fas-community-dev:oqmmvjjycpyxvxipcyli`; legacy keys also must match the project
reference and intended role. Unknown arguments, production names and arbitrary
URLs are rejected. Default local testing remains separate.

Fixture passwords contain random entropy and guaranteed lowercase/uppercase,
digit and symbol characters. User-editable `role=admin` metadata is deliberately
included to prove it does not grant database permissions.

Cleanup signs out fixture sessions, deletes recorded images through Storage's
API, and removes only recorded story/audit/invite/account IDs. Cleanup keeps
trying other categories if one fails and exits nonzero if any category fails.
Access JWTs cannot be recalled instantly; passwords and sessions are not printed
or retained, refresh sessions are revoked, and fixture roles/data are removed.
If interrupted, inspect the synthetic records for that run before repeating.

## Recorded result: 15 October 2026

All seven origin-permission groups passed using the hosted publishable key and
real Auth, PostgREST and Storage services: draft text/metadata/bytes isolation;
ownership; role and privileged-RPC protection; image MIME/size/path restrictions
and explicit approval; public publication reads and overwrite/move/delete denial;
fresh archival access and audit history; and invite email/expiry/revocation/reuse.

**The complete suite failed the separate cached-image revocation check.** Two
previously fetched URLs returned HTTP 200 with `cf-cache-status: HIT` after the
story was archived. Fresh URLs with a unique `cacheNonce` returned HTTP 400 with
cache BYPASS. This distinguishes correct current RLS from a previously cached
response. The test records the failure and continues to test the remaining rules;
it does not turn cache hits into a passing security verdict.

All fixtures were cleaned up. Independent follow-up queries verified zero test
accounts, stories and assets. Storage returned to the original one pre-existing
image; that unrelated image was left alone.

## Implemented and tested fix

The follow-up adds Edge Function `fas-story-image` and migration
`20261015000200_uncached_image_delivery.sql`. Direct client Storage reads,
listing and signed URL creation are blocked, including author/staff sessions.
The function queries asset metadata using the caller's Auth header and the anon
API key. PostgREST verifies the JWT and enforces the existing story/asset RLS;
anonymous callers use the anon role. Only permitted asset paths are fetched with
the server-only service key. After buffering the image, the function rechecks
permission and returns bytes with browser/CDN no-store headers. It never gives
clients a Storage URL or signed token. Only JPEG/PNG/WebP up to 5 MiB are served.

GET `/functions/v1/fas-story-image?asset_id=ASSET_UUID` serves an image. Anonymous
requests omit Authorization; signed-in clients send their session JWT as a Bearer
header. Private image UIs fetch bytes with that header and render a temporary
browser object URL. Never put user tokens or service keys into image query strings.
Gateway `verify_jwt=false` allows public anonymous images; custom authorization
is enforced by the caller-scoped PostgREST/RLS queries. Invalid and invisible
callers never reach privileged Storage. No caller-supplied Storage URL/path is used.

Deployed to **FAS development and production** after backup, local recovery and
migration rehearsal, and Ryan's explicit production approval. The full hosted
development suite now passes all seven
groups, including exact URL replay after archival, no-store headers, invalid
sessions and direct Storage/signing bypass denial. Cleanup was verified: zero
synthetic accounts/invites/stories/assets; one pre-existing image preserved.
Repository tests: 26 passed. Local migration and lint passed.

Deploy the function before applying the restrictive read migration. Switch any
community image client to this endpoint before that migration affects real users.
The existing static website has no community image client yet. For local API tests,
run `npx.cmd --yes supabase@2.120.0 functions serve fas-story-image` in a separate
terminal after applying migrations, and keep it running during the API suite.
The CLI supplies local credentials; no new secret file is needed.

## Production cutover gate

Supabase documents private bucket caching and using a unique `cacheNonce` to
fetch from origin. Its Smart CDN documentation also warns that cached signed-URL
responses may outlive the token's expiry. Merely shortening URL expiry is not a
complete immediate-revocation mechanism.

Before production rollout, inventory any previously issued raw/signed Storage
URLs. The new endpoint prevents new bypass URLs, but cannot retroactively erase
old CDN responses. Retire/invalidate those old URLs and account for propagation
time during cutover. Unique query strings alone are not a replay defense.
Object removal/cache invalidation has its own propagation delay and must not
destroy author drafts as a shortcut. Already downloaded content cannot be recalled.

The production cutover described above was completed with an empty production
image inventory. Read-only production probes passed; populated permission and
revocation fixtures remain development-only. Recheck the cutover conditions for
future changes. These results do not certify the entire community UI ready to launch.

References: [Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals),
[Smart CDN and cached signed URLs](https://supabase.com/docs/guides/storage/cdn/smart-cdn),
[Auth sign-out limits](https://supabase.com/docs/reference/javascript/auth-signout).
