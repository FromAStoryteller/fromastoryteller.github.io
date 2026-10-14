# Hosted FAS development API security checks

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

## Production gate

Supabase documents private bucket caching and using a unique `cacheNonce` to
fetch from origin. Its Smart CDN documentation also warns that cached signed-URL
responses may outlive the token's expiry. Merely shortening URL expiry is not a
complete immediate-revocation mechanism.

Before a production community rollout, define and test the required archival
behavior. If immediate permission revocation is required, prepare a server image
delivery path that checks current story/approval permissions for every request
and prevents caching, with direct Storage download/signing access restricted
accordingly. Unique query strings can verify origin permissions, but are not a
server-enforced solution against someone reusing a previously cached URL.
Object removal/cache invalidation has its own propagation delay and must not
destroy author drafts as a shortcut. Already downloaded content cannot be recalled.

This change provides the reproducible hosted tests and records the discovered
gap. It does not deploy that image-delivery architecture, change the live website
or certify production ready. Keep production migration separate until the
revocation behavior is resolved or explicitly accepted for launch.

References: [Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals),
[Smart CDN and cached signed URLs](https://supabase.com/docs/guides/storage/cdn/smart-cdn),
[Auth sign-out limits](https://supabase.com/docs/reference/javascript/auth-signout).
