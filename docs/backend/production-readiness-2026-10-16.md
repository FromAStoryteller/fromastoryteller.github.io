# Production readiness — read-only review, 16 October 2026

**Latest configuration:** Production signup validation and lifecycle retention schedules are now installed and verified; signup remains OFF. Lifecycle function deployment is blocked pending explicit approval of its custom authentication configuration. See [configuration result](production-hook-retention-2026-10-16.md). Earlier observations below are historical.

**Current status:** The four production database migrations are now installed after explicit database-only approval. Signup remains OFF. See [installation evidence](production-account-database-installation-2026-10-16.md). The observations below record the earlier preparation baseline; they do not describe the post-installation migration count.

Ryan approved the launch candidate wording after requesting From A Storyteller as
the public-facing operator name. This approval is recorded as preparation only;
candidate status and NULL activePublishedVersion are unchanged. No registrant
agreement or production release was created. PR #7 remains draft.

## Observed production state

Project fas-community-prod (`vzdicnufhidelaoeqbza`) is healthy in Sydney, PostgreSQL
17.11.0.003. MCP queries inspected counts/configuration only, without retrieving
personal rows, passwords, tokens or provider secrets. Dashboard controls were
viewed without saving changes.

| Item | Current observed state | Rollout action still required |
| --- | --- | --- |
| Migrations | Original five security migrations only | Exact dry-run/review of the four account migrations after backup confirmation |
| Existing content | One Auth identity/profile/admin role; no Community stories, assets or images | Preserve that identity and role; do not turn a test account into the owner of static content |
| Image bucket | Private; 5 MiB; JPEG/PNG/WebP only | Preserve these restrictions |
| Signup / anonymous / manual linking | All off | Leave off during preparation; public signup enablement needs deliberate approval |
| Email confirmation | On; email provider on | Keep confirmation required |
| Site URL | https://fromastoryteller.com | Preserve exact HTTPS origin |
| Redirect allowlist | Empty | Add exact verification and reset-password callback URLs from production-email-settings.json |
| Password requirements | 12 minimum; lowercase/uppercase/digit/symbol | Preserve; match UI checks |
| Secure email/password changes | On | Preserve; current-password-on-update setting remains off, not altered during review |
| Email link / access token expiry | Both 3600 seconds | Keep email wording consistent; access-token expiry is not a forced one-hour sign-out |
| Refresh replay protection | On; reuse interval 10 seconds | Preserve |
| Forced session time/inactivity limits | 0 (no forced limit), paid-plan controls disabled | Do not promise automatic inactivity sign-out; tab storage, explicit sign-out, server revocation and refresh checks remain relevant |
| Leaked-password screening | Off; dashboard requires Pro or above | No plan purchase/change made |
| Custom SMTP | On; sender name From A Storyteller; smtp.resend.com on 465 | Verify actual sender address/delivery and install the prepared subjects/templates; stored username/password were not read |
| Security notification toggles | All off on template overview | Recorded only; no toggle changed or extra email feature assumed |
| Before-user-created hook | No configured hook | Install reviewed function through migrations and explicitly configure the Auth hook |
| Account lifecycle function | Absent; only fas-story-image v1 exists | Deploy lifecycle with its own reviewed production opt-in and exact origin |
| Policy/lifecycle tables | Account policy tables/trigger absent | Install migrations; never backfill invented agreement |
| Retention schedules | pg_cron not installed | Install reviewed lifecycle/Cron retention schedules after prerequisites |
| Database Auth audit rows | Zero | Provider/external logs are separate; do not infer their deletion from this count |

All three PR checks passed for the policy-candidate commit `aec90a2`, including
both Cloudflare branch previews. This is not proof that the account changes are
on the live site.

## Fresh pre-account backup

A fresh backup was exported to an access-restricted local folder outside the
repository and Dropbox. It includes five SQL exports, exactly the five installed
migrations, safe operational notes, row counts and a verified-empty Storage
inventory. All 13 payload checksums passed; source counts were rechecked unchanged.
SMTP/API secrets were not exported. No backup contents are committed to Git.

Ryan confirmed AES-256 encryption with encrypted file names, successful archive
testing and Dropbox sync. This confirms the backup only, not a rollout. The
checksum-verified raw payload from that export was restored into a separate
disposable PostgreSQL container: network none, no published ports, no TCP
listener, RAM-backed data directory and no Auth/mail service. The normal local
database was not used because it publishes a host port on all interfaces.

All 32 exported tables matched exactly before and after the four pending account
migrations and six rollback SQL suites (access, security, lifecycle, registration,
policy agreements and contribution gates). The original identity/profile/admin
relationship survived; no declaration, release or agreement was invented, and
the policy requirement remained NULL. Initial rehearsal setup was corrected to
read SQL stdin explicitly and restore the managed Auth/Storage object privileges.
These corrections affected only the disposable target.

This is an SQL recovery rehearsal against compatible local managed schemas, not
a hosted cutover, SMTP delivery or live Auth login test. The agent did not decrypt
the user's archive; Ryan tested that archive, and the agent restored its original
checksum-verified payload. After success, the exact labelled container and raw
restricted export folder were removed with target/path checks. The encrypted
archive remains with Ryan under the agreed backup retention process. A safe
aggregate result is retained outside Git in outputs/PROD-ACCOUNT-BACKUP-RESTORE-RESULT.json.

The production CLI dry run, with vault updates explicitly skipped, listed exactly
the four reviewed account migrations and no seed or role imports. No migration
was applied. Recheck this dry run immediately before a later approved rollout.

## Proposed public policy routes

The draft branch now prepares /privacy/ and /terms/ from the approved launch
candidate. Only page title/canonical/indexing and the pre-launch fallback link
differ from the frozen snapshots. The fallback points to exact copies of the
previous root documents from origin/main commit
79a91d28f3f2de3fa49595a1de8c25601c5a7e7f, preserved under
/account/policy-history/site-before-viewer-accounts-2026-10-16-v1/ with checksums
and Git provenance in the registry. This is source provenance, not proof of the
currently deployed Cloudflare bytes. The frozen launch candidate and acknowledged
drafts were not edited. activePublishedVersion remains NULL; these source changes
do not publish a policy or enable signup.

## Order of the later approved rollout

1. Complete the backup step and isolated exact-backup recovery verification.
   Preserve the current five-migration baseline as the rollback reference.
2. Prepare the final source changes for the live Privacy/Terms routes while
   retaining the immutable candidate copies. Review the exact source diff and
   policy hashes. Do not set published status solely because wording was approved.
3. Obtain deliberate approval of the concrete production change set. With signup
   still disabled, apply only the reviewed four pending migrations, configure the
   hook/retention jobs, and deploy the lifecycle service. Verify the existing
   identity/role, permissions and public-read behavior after each stage.
4. Publish matching website documents and the immutable server release, with the
   actual publication timestamp and matching versions/hashes. Set the reviewed
   server requirement and production lifecycle/build opt-ins only in the approved
   sequence. Branch previews must stay disconnected; never deploy a failed build
   or reuse an old output directory as evidence of readiness.
5. Perform a deliberately approved initial public-signup window and immediately
   complete the real-inbox smoke test. Public signup cannot be tested while the
   global signup switch remains off; do not call this a private/allowlisted test.
   Other people could register during that window. Ryan must enter the password,
   verify the email and complete any actual Terms agreement himself. Test viewer
   permissions, sign-out/session handling, recovery, downloads and confirmed
   deletion without reassigning existing static work.
6. If the smoke test fails, disable new signup and the account frontend using the
   reviewed operational controls, preserve existing account data and investigate.
   Do not drop new tables, erase agreements or blindly restore an older backup
   as an automatic rollback. Continue normal registration only after validation.

The existing production account is not assumed to have accepted the new Terms.
No email was sent, public signup window opened or production setting changed by
this review. Play My Path was not accessed.
