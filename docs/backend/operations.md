# FAS current operations

Updated 14 October 2026. This records completed setup and its operating boundaries;
the setup and restore guides remain the repeatable procedures. No credentials or
backup data belong in this repository.

## Completed foundation

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

| Environment | Purpose | Operator working copy |
| --- | --- | --- |
| Local | Disposable development and restore tests on the PC | Original website checkout; local .env.local |
| Hosted dev | Real-service testing with disposable content | Original website checkout linked to dev |
| Hosted prod | Real community accounts and content | Separate FAS-Production-Setup checkout linked to prod |

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

## Before community launch

The existing static website remains usable. Account/profile pages, viewer signup,
invitation delivery/acceptance, story submission/moderation and image handling
still require implementation and end-to-end checks. Public signup remains disabled
for now. An account alone must not grant contributor privileges.

The next security task should exercise anonymous/viewer/contributor/admin API
requests, draft isolation, ownership, role protection, invitation validation and
private Storage access. It does not require finished profile pages. Reconcile the
historical immediate-publication proposal with the currently implemented review
workflow before changing rules. Server image validation, safe text rendering and
exact Auth redirect/recovery routes remain launch requirements.
