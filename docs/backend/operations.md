# FAS current operations

Updated 18 October 2026. Studio V1 is deployed and accepted. This records the current operating boundaries;
the setup and restore guides remain the repeatable procedures. No credentials or
backup data belong in this repository.

## Current release

Viewer accounts, contributor profiles and Storyteller Studio V1 are live. Contributors publish their own stories/blog posts and upload verified covers without administrator approval. Existing source-file stories/games/tools retain their URLs and source editing; their publishing settings and insights are available in Studio. Tools use FAS attribution; the specifically granted owner can select personal/FAS for other content.

See [V1 acceptance and follow-ups](studio-v1-handover.md), [Studio rollout](studio-production-rollout-2026-10-17.md) and [publishing-name rollout](publishing-identities-release-2026-10-17.md). The latest [lifecycle/discovery release](story-publishing-lifecycle.md) passed 155 tests and 18 browser scenarios, hosted DEV rollback fixtures, and live verification of all 14 existing file pages. Production content/profile fingerprints were unchanged. Automatic recovery is also live; see [edit/autosave recovery](studio-edit-autosave-recovery.md).

The latest confirmed pre-change backup was 18 October 2026 at 12:08 NZDT: five SQL exports, zero-file Storage inventory, encrypted/tested archive and confirmed off-site sync. Backup integrity is not a full hosted restore rehearsal. Ryan asked to defer new backups for the current lifecycle work; that additive rollout and its unchanged-data verification are recorded in [lifecycle release](story-publishing-lifecycle.md). Keep the manual routine below for subsequent changes.

## Foundation history — 14 October 2026

- Existing website hosting uses Cloudflare Workers Static Assets. Production
  follows main with the configuration in [the hosting guide](../cloudflare-production-deployment.md).
- Local Supabase runs in Docker as `fas-community-v1`. Local lint and transactional
  database access/workflow tests passed.
- Separate Sydney hosted projects `fas-community-dev` and `fas-community-prod`
  have all three initial migrations applied, matching migration history, RLS on
  all six application tables and a private `fas-story-images` bucket.
- Separate operator/admin accounts are configured. Restored local sign-in/admin
  access and hosted production sign-in/admin access passed.
- Resend's `auth.fromastoryteller.com` sending domain is verified with Cloudflare
  DNS; separate dev/prod sending keys are used by custom SMTP. Recovery email
  delivery passed for both projects; complete recovery links/pages are not tested.
- Development database data was restored locally. A sample image was exported,
  restored and re-exported with matching filename, size and SHA-256 checksum.
- Initial dev/prod backups were encrypted, verified by the operator and stored
  in Dropbox. The temporary test image was removed from the live dev/local buckets.
- Foundation PR #3 was merged; both operator checkouts were updated to main.

## Environment separation

| Environment | Purpose | Explicit target |
| --- | --- | --- |
| Local | Disposable development and restore tests on the PC | FAS local configuration; API 55321 |
| Hosted dev | Real-service testing with disposable content | fas-community-dev: oqmmvjjycpyxvxipcyli |
| Hosted prod | Real community accounts and content | fas-community-prod: vzdicnufhidelaoeqbza |

Git branches do not change the CLI's project link. Verify the project before any
linked database command. Git push updates source; it does not apply Supabase
migrations. Test new migrations locally/dev, back up prod, then apply reviewed
changes deliberately. Keep applied migration files unchanged.

Docker is needed for the local stack and the current CLI database export method;
it is not needed to keep hosted Supabase or the live website running. Dropbox is
needed to sync encrypted copies, not to operate the hosted database.

## Manual backups

Ryan owns the manual routine: production weekly and before database changes;
development before significant changes. Follow [backup-restore.md](backup-restore.md)
for all SQL exports, migration history, repository commit and image inventory.
Use dated archive names; encrypt/test before placing copies in the private Dropbox
website Backups/FAS-Backups folder. Keep passwords separately and check sync.
No scheduler, automatic retention pruning or automatic restore is installed.

## Follow-up work

The accepted V1 is complete. Further usability/function refinements, source-content editing/type expansion, private-image cleanup, reporting/ads/payment setup and a full isolated hosted restore rehearsal are tracked in [the handover backlog](studio-v1-handover.md#follow-up-backlog).

Accounts do not grant contributor or FAS-publishing rights automatically. Administrators moderate rather than approve every publication. Analytics reporting is disconnected and no ads, earnings or payouts are active. Retain environment separation, safe text/image rendering, current session checks and the documented rollback procedures during future work.

## Image storage release — 18 October 2026

Profile images, cover management and automatic reference-aware byte cleanup are live. See [image storage](image-storage.md) for migration mappings, validation, scheduled cleanup, export/deletion coverage and rollback. Verification: 162 tests, two actual codec checks, 23 browser scenarios and 27 disposable DEV Storage checks. The user's existing instruction to defer backups until updates are finished applies to this rollout; no existing stored files were removed.
