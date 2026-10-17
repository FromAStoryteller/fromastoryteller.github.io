# Storyteller Studio production rollout — 17 October 2026

Status: production backend installed and verified. Operator confirmed encrypted archive integrity and off-site sync on 17 October 2026 at 22:59 NZDT (09:59 UTC). PR #26 merged and deployed; a reader redirect-mode compatibility fix is in progress before final acceptance.

## Reviewed release

- PR #26: Build self-service Storyteller Studio with permanent content URLs.
- Reviewed implementation head: fd52d4226e606f38b710b04b1c21ffb85baa3c76; CI run 101 passed.
- Current main/base: 4e3b3bc7511f860e11bb107956b01c9dc23ab86a.
- 130 local tests, real DEV API publication without approval, exact fixture/Storage cleanup, hosted rolled-back SQL rehearsal, reference/index checks, both build candidates and real Deno codec smoke checks passed.
- DEV browser confirmed the existing cover is Ready to use without approval. Never-published insights are hidden; title paths, standard paragraphs and checkbox alignment are implemented and checked.

## Production baseline (read-only checks)

- Target: fas-community-prod (vzdicnufhidelaoeqbza), separate from DEV.
- 17 installed migrations through retire_moderator_contributor_removal. Four earlier production migration timestamps differ from repository versions; preserve their mappings in production-admin-release-2026-10-17.md. Do not use blind CLI push/repair.
- One Auth account; zero Community stories, registered assets or uploaded image files.
- fas-story-images is private, limited to 5 MiB, accepting JPEG/PNG/WebP.
- Existing fas-story-image v3 and fas-account-lifecycle v3 are ACTIVE. Do not redeploy or change either for this release.
- pg_cron is installed. The fas-community-publication job is not yet installed. The idempotent installation must not replace other jobs.

## Required backup gate

The existing operating choice is a manual production export before database changes: SQL roles/schema/data/migration history plus a Storage inventory, encrypted and verified, with an off-site copy. See [backup-restore.md](backup-restore.md). There are no current image bytes, but record/verify the empty inventory. Do not treat a repository checkout or the DEV fixture cleanup as a production backup.

The documented CLI dump procedure needs Docker. Docker was verified available through PATH (the initial default-installation-path probe missed it). The operating procedure assigns backup encryption/password custody and off-site verification to the operator. Ask the operator to complete or confirm a fresh backup for this exact release before any production migration. Never request its password, database password, SQL contents or service key in chat. Record confirmation and backup time, not confidential backup contents.

## Ordered installation after backup confirmation

Apply only these seven missing reviewed sources, in this order, through the explicitly targeted production migration API. Capture production-generated versions in this document rather than rewriting history.

| Source | SHA-256 (UTF-8 LF) | Production recorded version |
| --- | --- | --- |
| 20261017024843_story_studio_metadata.sql | aeb4d90d68dffc846ad054daf82c0cfc548032f651ed4ebc3c312c0ab40e5526 | 20261017100104 |
| 20261017032053_storyteller_studio_publishing.sql | 157ebd31dda0c20bbc08aa2f7efeb36b959a6836f6dd3ccdb805da0699be7fb4 | 20261017100119 |
| 20261017032357_studio_reporting_foundation.sql | cc49ea8294517c3e4b6396238e65a8f08b77adea41d0acdaed48dd79d7864d10 | 20261017100128 |
| 20261017033843_studio_catalogs_and_metadata_versions.sql | 221cdfdb411c28d592a04bb6d443708179d00c39a3a00c5b7bc484cac61c1d3b | 20261017100138 |
| 20261017035818_studio_warning_request_retention.sql | 2bdea4c4ac2b55cce83cf2f5c85cefc63d26fcaade8f192a4737cc488439115e | 20261017100151 |
| 20261017083044_studio_unique_content_addresses.sql | ae2d11da3217e9553e5c0679a251779368fcc65ec4ed55bf0173fa0babfb6401 | 20261017100201 |
| 20261017091956_studio_self_service_addresses.sql | f26c9eb6e6cfa109867916c58043443a5575edb085ae4502affd667109726ad9 | 20261017100211 |

1. Recheck the PR head/CI and baseline before mutation. If the head or production data changed, review the difference first.
2. Install the seven migrations and compare relevant DEV/production function definitions and permissions. Do not run synthetic Auth/Storage fixtures against production.
3. Deploy only fas-studio-cover using its three reviewed package files (index.ts, handler.mjs, normalize.mjs; no import map). Keep verify_jwt=true. The package's exact-origin configuration selects the production apex automatically and uses Supabase-provided server secrets; no browser secret is required.
4. Install supabase/ops/studio-publication-cron.sql. Verify exactly one active fas-community-publication job on * * * * *, executing select private.publish_due_content();. Other existing account/retention jobs remain untouched.
5. Compare row counts and identities with the private baseline; run schema/permission queries and security advisors. Confirm anonymous access to unpublished content remains denied, verified_at/dimensions are service-only, publication no longer requires approval, and the public projection returns only published eligible content.
6. Capture the current active Cloudflare deployment version in the operator dashboard as the immediate website rollback target. Wrangler inspection currently lacks Cloudflare authentication here; use the existing main-branch integration rather than creating a temporary account or requesting a broad API token.
7. Merge PR #26 using an expected-head SHA lease. Main triggers the existing Cloudflare production integration. Preserve existing production account build variables/runtime config; branch previews remain disconnected.
8. Wait for a successful main deployment, then verify HTTPS/apex/www, old static stories, existing account/profile/admin pages, Studio, old read-link redirects and new community path routing. Test the real operator UI without publishing or deleting its work. No production test accounts or disposable uploads.
9. Record production migration mapping, cover revision/digest, cron identity, merged SHA, Cloudflare deployment version and live checks. Only then mark the task complete.

## Rollback

Before merge, a failed migration or cover deployment should stop rollout; keep the old website live. Each migration is transactional. Do not drop newly added tables or erase accepted user content to roll back.

After a site issue, restore the captured prior Cloudflare deployment (or revert the release merge and let main redeploy). Retain additive schema/data and exact migration history. If scheduling is implicated, disable only fas-community-publication while investigating; do not unschedule unrelated jobs. Retain uploaded bytes and ownership records. Prefer a reviewed forward fix for database/function issues; a database restore uses the separately verified backup plan and must preserve the latest deletion ledger.

Hosting rollback does not roll back database data. No DNS, nameserver, Auth/SMTP or policy-agreement changes belong to this Studio release.

## Installation evidence

- Operator generated all five SQL exports with CLI 2.120.0. Storage export succeeded with zero files and a SHA-256 inventory. The complete dated backup was encrypted, archive-tested and synced off-site; password remains private. This confirms archive integrity, not a full hosted restore rehearsal.
- All seven reviewed source hashes matched before installation; production-generated migration versions are recorded above. Existing migration history was preserved.
- Production and DEV match across all 72 application function definitions/ACLs after normalizing line endings, all 33 policies and all 15 non-internal triggers. The sole initial raw-hash difference was CRLF versus LF in the pre-existing clear_image_approval function.
- All public/private application tables have RLS. Anonymous callers cannot execute the work-library RPC; authenticated callers cannot execute verified-cover registration. Ten static addresses are reserved.
- fas-studio-cover v1 is ACTIVE, verify_jwt=true, bundle digest fb53ec82608cd3df5b4f02da3151f15e5a3f845f681678f22f9911607bf26513. Existing image/account functions were untouched.
- Publication cron job 3 is active on * * * * *, command select private.publish_due_content();. Repeated executions succeeded. No publication job failures.
- Post-installation counts remain one Auth account, zero Community stories/assets/image files. No production fixture accounts or uploads were created.
- Security advisory categories remain the documented intentional RLS/no-policy and checked public/authenticated definer functions, plus the existing leaked-password-protection setting notice. No new exposed-table issue.
- Cloudflare dashboard currently serves version 9631d1c6 at 100% traffic from main commit 4e3b3bc7511f860e11bb107956b01c9dc23ab86a. Retain this deployment as the immediate website rollback target. Existing production public account configuration is enabled and points to the correct production project.

## Website release and runtime correction

- PR #26 merged as b8a8894d1c7de95b317dc9b947efb16c31c6fdbd. Cloudflare build 0c85d626-8698-4448-ad7f-d08685c63234 deployed version cb6614e9-2205-4770-ab86-58e60743d728 successfully. Production account configuration was preserved exactly; the real signed-in Studio library loaded.
- Live verification found missing Community paths returned 503. Reproduction in the installed workerd runtime identified redirect: error as unsupported; the runtime explicitly requires manual/follow. Manual mode retains the fail-closed result.ok check and never follows upstream redirects.
- The corrected runtime rehearsal returns 404 for a missing public story. Reader tests cover manual mode, denied upstream redirects, retained no-store/noindex failures, static precedence and safe published metadata. No database or Auth changes are needed for this correction.
- Public-file differences were attributable to Windows/Git line endings, Cloudflare-managed robots additions, and the intentional 404 reader shell when no story is supplied. Existing static stories, HTTP/HTTPS and www redirects, source-file exclusion and all real account settings remained available. Final reader-route acceptance remains pending deployment of the correction.
