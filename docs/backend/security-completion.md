# Enforce database and storage security: complete

Completed 15 October 2026 for FAS Community V1. Play My Path remained separate.
The reviewed security changes are merged and applied to both FAS hosted projects:

- Development: `fas-community-dev` (`oqmmvjjycpyxvxipcyli`).
- Production: `fas-community-prod` (`vzdicnufhidelaoeqbza`).

## Acceptance evidence

| Done-when requirement | Evidence |
| --- | --- |
| Server permissions cover anonymous, viewer, contributor and admin actions | Actual Auth/Data API/Storage tests passed all seven groups; protected roles, column grants, RLS and checked workflow functions are deployed. |
| Direct API requests cannot read private drafts | Other authors, viewers and anonymous callers were denied draft text, asset metadata and image bytes. |
| Authors cannot modify another author's work | Cross-author edits and ownership reassignment were denied; reviewed content and images cannot be replaced by clients. |
| Users cannot self-promote to admin | Role insert/update/upsert/delete, editable sign-up metadata spoofing and unauthorized staff RPC calls were denied. Verified invitation acceptance grants contributor only. |
| Public readers get published stories only | Published reads passed; drafts, rejected/unpublished content and archived stories stayed hidden. |
| Public images require approval and publication | Unapproved images stayed hidden; approved published images were served through the checked endpoint. Exact endpoint URL replay after archival was denied. |

The last full hosted development API run passed all seven groups **after** the
production rollout. Independent cleanup found zero synthetic accounts, invites,
stories or assets, while preserving the one pre-existing development image.

Production matches development's **23 FAS/application policies, 12 function
definitions and execution grants, 8 client table grants and 67 client column
grant entries**. Function text comparisons normalize CRLF/LF line endings only.
This checks database permission parity, not identical hosted settings or content.

Both additive migrations are present with their exact repository versions:
`20261015000100_security_hardening.sql` and
`20261015000200_uncached_image_delivery.sql`. The original three applied migration
files were not changed. Edge Function `fas-story-image` is active in both projects.

## Production rollout and recovery

Ryan secured an encrypted pre-change backup, tested it with 7-Zip and confirmed
Dropbox sync. A recovery rehearsal in a separate local PostgreSQL 17.11 database
matched all saved rows across 32 exported tables. Account/profile/admin relationships,
the private bucket and fresh-account trigger passed. Both pending migrations and
both transactional SQL security suites passed against that recovered database.
The disposable database and temporary recovered data copies were removed.

Ryan then explicitly approved production deployment. The endpoint was deployed
and verified before the direct Storage read restriction. Production had no images,
so no old stored image URLs required a cutover. Its original administrator account
and profile remained intact. No production fixture accounts/content were created.
Nine read-only production API probes and catalog checks passed. Production has no
published image bytes, so the populated delivery/revocation tests ran in development.

[PR #4](https://github.com/FromAStoryteller/fromastoryteller.github.io/pull/4)
and [PR #5](https://github.com/FromAStoryteller/fromastoryteller.github.io/pull/5)
are merged. The security rollout merge is
`ea7df38e94a784a167c2ef22536e3c642d56a44d`.
[GitHub validation](https://github.com/FromAStoryteller/fromastoryteller.github.io/actions/runs/38643295507)
and [website deployment](https://github.com/FromAStoryteller/fromastoryteller.github.io/actions/runs/38643294815)
passed, as did both Cloudflare Workers builds. The Workers origin passed 148 checks.
The custom domain matched 147 of 148 strict byte checks; its `robots.txt` includes
Cloudflare's managed crawler block. A separate check confirmed the original rules
and ordinary search access were preserved. Crawler protection was not disabled.

## Continuing obligations and separate launch tasks

No manual database setup remains for this task. Repeat the guarded development
API suite after future permission changes; inspect production drift without running
fixture-writing tests there. Use [security.md](security.md) and
[hosted-api-security.md](hosted-api-security.md) for the test procedure.

Maintain the documented manual backup routine. Preserve server-only keys and the
separation between FAS development, FAS production and Play My Path.

The community interface, safe rendering, Auth redirects/email flows and server
image decoding/re-encoding are separate launch tasks. Future image clients must
use `fas-story-image` by asset ID, with session authorization for private images.
Downloaded copies cannot be recalled. This security task does not certify the
whole community product ready to launch.

Production advisors have no ERROR-level findings. The invite table deliberately
denies direct access; five checked workflow RPCs deliberately use SECURITY DEFINER.
Their notices are reviewed, not silently dismissed.
[Workflow advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
Leaked-password protection is disabled and remains a separate Auth/plan decision:
[Supabase password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
