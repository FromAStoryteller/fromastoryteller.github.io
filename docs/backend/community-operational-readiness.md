# Community V1 operational readiness — 19 October 2026

Status: complete for Community V1 functional readiness. Production smoke/build checks passed and Ryan confirmed the fresh encrypted/tested/off-site backup on 19 October 2026 at approximately 06:56 NZDT. Brand's final logo remains optional for functional readiness.

## Release and smoke evidence

Production is the Cloudflare Worker `fas-site-production`, HTTPS origin https://fromastoryteller.com, with Supabase `vzdicnufhidelaoeqbza`. Hosted DEV remains `oqmmvjjycpyxvxipcyli`. Verify the project before every operation; a Git branch does not select a backend.

Baseline main `f879eb90349459dec38821119d9615afe816698f` passed production Cloudflare build 117608656044, preview build 117608581670, deployment 117608300519 and build validation 117608231640. Community [end-to-end acceptance](community-v1-acceptance.md) records passing real DEV API/account/Studio tests, two authors, independent admin roles, mobile/keyboard, failed saves/email, recovery and lifecycle. Ryan's real production Studio test reached /stories/test/ and permanent deletion worked. Its story, asset records, Storage bytes and one-off address reservation are absent. Controlled production verification/recovery/invitation email and sign-in were verified on 18 October; no additional account or mail is created by this readiness audit.

Repeat the read-only smoke from a checkout of the deployed source:

    node scripts/test-fas-operational-readiness.mjs --production-read-only

Or run GitHub Actions **Community operational readiness** with the deployed ref. It has no schedule or secret input. It checks policy hashes/runtime, anonymous authorization boundaries, account/support routes, six exact live JS sources, runtime no-store caching, HTTPS/www path/query redirects, every repository-indexed content page, unavailable-story behavior and unpublished maintenance paths. A source mismatch after a deliberate frontend rollback requires checking the actual deployed ref; do not suppress it.

Read-only production smoke job **117744233447** passed on 19 October (Auckland): exact six deployed sources, 14 existing content pages, account/support/policy routes, redirects, private exclusions and public-policy/authorization checks. Build **117744233652** passed the 174 automated tests, actual Deno image codecs, references/index validation and Worker bundling. Source-only runbook edits do not claim a new live account/email test.

## Background jobs and server audit

Read-only production review on 19 October (Auckland):

| Control | Result |
| --- | --- |
| Lifecycle retention | Active every 15 minutes; zero failures in previous 24 hours |
| Cron-history retention | Active daily; zero failures in previous 24 hours |
| Scheduled publication | Active every minute; zero failures in previous 24 hours |
| Reference-aware image cleanup | Active every five minutes; zero failures in previous 24 hours |
| Transactional email retries | Active every minute; zero failures in previous 24 hours |
| Recent pg_net responses | 72 responses in last six hours, all HTTP 200 and none timed out |
| Queues | Zero pending image cleanup, pending email jobs or failed email jobs |
| Environment configuration | Image/email worker base URLs match production; email worker enabled |
| Images | Private bucket; active upload/delivery/cleanup functions |
| Edge services | All eight deployed functions ACTIVE |

Cron SQL success alone is insufficient proof of downstream HTTP delivery; inspect pg_net status and pending/retry counts too. Never display raw response bodies, outbox tokens, recipients or worker credentials in an operational report.

Security advisors have no ERROR findings. Existing findings remain: 26 private RLS tables intentionally have no client policies; five public read projections and 30 authenticated guarded SECURITY DEFINER functions need their deliberate grants; leaked-password protection is disabled under the previously recorded plan limitation. Do not revoke all function grants or open private policies to silence a lint. Inspect an unexpected new finding against the tested access model. Links: [private RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [anonymous functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password screening](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No paid upgrade or security-setting change was made.

## Backup closeout

Latest operator-confirmed encrypted/tested/off-site archive: 19 October 2026, confirmed at approximately 06:56 NZDT, named 2026-10-19-community-v1-readiness. Ryan reported successful exports of all five SQL files and zero-file SHA-256 Storage inventory, then confirmed completion of backup notes/checksum inventory, AES-256 archive with encrypted file names, archive testing, off-site Dropbox sync and secure provider-recovery record steps. Credentials and archive contents were not sent to chat or committed. Archive testing/sync is operator-reported; the assistant did not inspect or decrypt the archive. Retain/prune prior sets under the 30-day deletion-data retention policy.

Use [the current backup procedure](backup-restore.md), in a quiet window with no author edits/uploads/moderation/deletions or scheduled publication due. If other contributors are active, arrange an enforced write pause with an operator; merely closing Studio is not a write freeze. Do not claim cross-service snapshot consistency if writes occurred during database/image exports.

Create a NEW private working folder outside Git/website/Dropbox:

    C:\Users\Ryan\Documents\FAS-Backups-Private\2026-10-19-community-v1-readiness

The set must include roles, public/private schema, public/private/Auth data, both migration-history exports, all private bucket bytes with SHA-256 inventory, SQL checksums, the exact source commit and non-secret restore notes. Keep a separate secure record of hosted Auth redirects/hooks, SMTP settings, Edge function versions and secret recovery locations, Cloudflare build variables/routes and Resend webhook configuration. Never copy secret values into Git or support tickets. Provider secrets/settings are not restored by SQL or Git.

Encrypt the COMPLETE folder with AES-256 and encrypted file names, test the archive using its saved password, copy it to the established private Dropbox FAS-Backups folder and confirm sync. Keep the password separately. Do not remove plaintext until archive testing and off-site sync are confirmed. Apply the existing manual weekly/pre-database-change cadence and 30-day retention; no backup scheduler or retention automation was installed. Backup integrity is not a full hosted restore rehearsal.

## Recovery and rollback

| Incident | First response | Recovery boundary |
| --- | --- | --- |
| Writer save/offline/session/conflict | Keep text open; download text/recovery under More options; restore same-account recovery after sign-in; reload saved server version only after preserving unsaved words | Automatic tab recovery is temporary, not a backup; expired/deleted browser data may be unrecoverable |
| Accidental author archive/unpublish | Open Your work, filter Archived if needed; restore author archive to private draft; review and publish explicitly | Moderation locks require admin release; permanently deleted work has no self-service restore |
| Email/provider incident | Refresh delivery status; check provider state; use existing retry instead of creating duplicate invitations; manual private link only to intended verified recipient | Provider acceptance is not Delivered; never forward passwords/tokens to support |
| Frontend release defect | Select a recorded known-good compatible production Worker deployment; roll back/redeploy the complete Worker AND static assets; run smoke from that exact ref | Keep Supabase additive schema/data and current policy snapshots/registry; old frontend must support current APIs and Terms |
| Edge release defect | Redeploy reviewed compatible source for only affected functions to the explicit production project; verify its documented JWT/custom-auth mode and smoke | Keep reservations, ownership/session checks, cleanup contracts and immutable email template versions; do not bypass them |
| Missing/corrupt data | Freeze writes; preserve current safety snapshot and NEWEST deletion ledger; rehearse recovery into a fresh isolated target with signups/mail/cron/public access disabled | No automatic/in-place production restore, no replay of invitations or old sessions, no deletion resurrection |

The source baseline above identifies a successful release; Cloudflare deployment/version IDs must be selected from that commit's successful deployment in the dashboard. Do not choose the initial Hello World version. Provider-native rollback restores a deployment, not database contents or provider secrets. Retain the existing production account build variables. Verify current policy document hashes and server requirement after rollback; never roll Terms or recorded acknowledgements backwards.

GitHub Pages is only a historical static fallback. It cannot provide the current Worker story routes or full Community behavior; DNS cutover to it is not the normal Community rollback. Do not change nameservers, MX, domain routes or database data for an ordinary frontend defect.

A full hosted restore/cutover of the CURRENT release is not rehearsed or timed. Earlier isolated SQL/account/Auth/Storage rehearsals are retained in [local recovery evidence](local-restore-rehearsal.md) and [backup guidance](backup-restore.md). Before actual recovery, prepare a target-specific import plan for all current tables/seeds, circular story/cover references, immutable policy documents, original declaration/agreement timestamps, publishing identities, newest deletion ledger, schedules, invitations and image paths. Keep policy requirement NULL during Auth import; restore original agreements before enabling it. Restore bytes through Storage API, never by inserting raw storage.objects. Revoke restored sessions and do not grant deleted identities roles. Keep background publication/email/cleanup disabled until reconciliation finishes. Compare hashes/counts, then test a surviving synthetic identity/ownership/publication and deleted-account denial before any deliberate cutover. Never run generic rollback fixtures against recovered personal data.

A successful local rehearsal or checksum test does not certify a full hosted import. No guaranteed recovery-time objective is claimed. Under the existing weekly manual export policy up to a week's new changes may be lost; backup frequency should be revisited before wider contributor use.

## Basic support and escalation

Public support: https://fromastoryteller.com/contact/ or fromastoryteller@gmail.com. Ryan is the initial operator; no external helpdesk or automatic alert routing is installed.

For reports request the affected public URL (or private draft ID without text), approximate time/timezone, browser/device, exact displayed error and whether Save/preview/sign-in/email was involved. Ask writers to preserve/download unsaved text first. Never request their password, API key, private email link, session token, or full private manuscript. Redact screenshots before sharing.

Triage in order: provider status/outage; correct production origin; deployment source match; signed-out public page and catalogue; server session/policy gate; role/ownership; actual failed response in restricted logs; cron/HTTP/queue state. Support staff cannot edit another author's manuscript; use the existing admin moderation/role controls and audit. Contributor status and admin status remain independent. Do not self-promote a test identity or change bylines to solve an access issue.

For verification/recovery, request a fresh email using the generic UI, check Inbox/Spam, expire/revoke obsolete invitations if needed, and use Admin's existing delivery controls. For deletion/export, use Account settings and the existing title/password confirmations. Published addresses normally remain reserved to protect old links; the explicitly authorized /stories/test/ cleanup was a one-off test exception.

Review operational health before invites and after each release: run the read-only smoke; inspect failed/aging queue counts, cron/pg_net failures and provider delivery events; confirm backup age and encrypted off-site sync. This is a manual checklist, not a claim that monitoring/alerts are configured.

## Brand and deferred work

Keep the current theme/placeholder branding. Apply final logo assets only when Brand supplies them: verify licensed originals, transparent/dark/light suitability, favicon/header sizing and mobile/accessible name behavior in a separate source change. No final logo is available or applied here, and branding does not gate functional readiness. Studio public-page alignment, analytics, ads and monetization remain separate work.

## Completion gate

- Production account/policy/publishing smoke and live-source checks pass.
- Existing controlled account/email acceptance and Ryan's real Studio publishing test remain recorded; no duplicate production fixture needed.
- Background job/access/queue checks are recorded and operational runbooks are available.
- Completed: Ryan confirmed the new encrypted, tested, off-site backup and provider-recovery record steps on 19 October at approximately 06:56 NZDT.
- Preserve explicit limitation: current full hosted restore/cutover is a separate rehearsal, not an achieved result of this task.

## Final closeout

All functional readiness gates above are satisfied. Main a9309476f549f1ed1a5d827a9abe8dedba375aaf subsequently passed production and preview Worker builds, deployment and validation. The post-export production count check matched the empty image inventory: 1 Auth identity/profile, 2 role rows, 0 Studio stories/assets/moderation rows, 1 invitation, 0 Storage objects and 32 applied migrations. Counts are point-in-time operational evidence, not a substitute for inspecting/restoring an encrypted backup. The latest archive includes SQL/hash notes referencing that exact source revision.

No further operator action is required to close this task. Full current hosted recovery/cutover rehearsal, recurring backup automation, final Brand logo and story-page visual polish retain their separately stated scope/limitations. No production schema/data, branding, billing or credentials were changed by readiness closeout.
