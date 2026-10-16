# Contributor permissions

Implementation prepared 17 October 2026 (New Zealand).

## Scope and current rollout

This implements the database/API permissions, not the story editor or upload UI.
Migration `20261016211439_contributor_permissions.sql` is installed in FAS DEV
(`oqmmvjjycpyxvxipcyli`). Production is unchanged pending the real Auth/Data API/
Storage regression run. Do not mark this task complete until that run and the
production deployment/parity checks pass.

The local PostgreSQL test and hosted DEV transaction passed. The API runner could
not start because private Supabase CLI access is unavailable in this workspace;
no API fixture accounts were created by that attempt. Hosted SQL fixtures rolled
back. SQL role tests do not replace real JWT, PostgREST and Storage verification.

## Permission matrix

| Operation | Guest/viewer | Contributor | Staff |
| --- | --- | --- | --- |
| Read published story | Yes | Yes | Yes |
| Read private draft | No | Own | Yes, for moderation |
| Create a draft | No | Own | Own |
| Publish/update/unpublish | No | Own, unless staff archived | Own, unless staff archived |
| Rewrite another author's text | No | No | No |
| Delete a story | No | Own | Own |
| Archive for moderation with a reason | No | No | Yes |
| Reopen staff-archived content | No | No | No client operation |
| Upload/register a new unique image | No | Own unarchived story | Own unarchived story |
| Overwrite/move/delete Storage bytes directly | No | No | No |
| Approve an image for public delivery | No | No | Existing checked staff RPC |
| Change own role | No | No | No |

The stored `member` role means contributor. A viewer has no role row. Staff means
`moderator` or `admin`. Authorization reads protected database roles, never editable
Auth metadata. Contribution writes require an active account and acceptance of any
currently required policy release. Existing account export/deletion paths remain
separate and available under their existing rules.

## Client contract for the future editor

- Insert `author_id`, `slug`, `title`, `summary`, `body` into `stories`; the server
  generates ID/timestamps and starts in `draft`.
- Update only own content fields, `cover_asset_id`, and `status` (`draft` or
  `published`). `published_at` is server controlled. Live edits retain publication
  time; unpublishing clears it. Republishing sets a new publication time.
- Staff use `moderate_story(target_story, 'archived', note)`. This no longer
  publishes or rejects submissions. Existing submitted/rejected rows may be
  reclaimed by their author as a draft or published story.
- Staff archival cannot be bypassed by changing status, body or image metadata.
  A separate reviewed administrative procedure is required for reinstatement.
- Own story DELETE removes text and cascading asset metadata immediately.
  Moderation history remains, with its now-deleted story reference set to null.
  The editor must confirm deletion and offer export before invoking it.
- Storage paths remain `author_uuid/story_uuid/unique_filename.jpg|jpeg|png|webp`,
  max 5 MiB with matching permitted MIME. Upload with `upsert:false`, then register
  the asset. Published stories can receive new uploads; existing bytes stay immutable.
- Private/public images still go through `fas-story-image` by asset ID. The bucket
  stays private, listing/signing/direct delivery stay denied, and no-store delivery
  rechecks caller access. Unapproved images stay private.

Image decoding/re-encoding and a future automated safety approval path belong to
the upload build. This migration does not make arbitrary contributor bytes public
or require staff approval for story text. Story deletion can leave private orphaned
bytes; these are inaccessible through the image endpoint and must be removed by
trusted Storage API maintenance. Account deletion already removes owned files.
The upload build must integrate per-story file cleanup before its delete UI ships.

## Verification and next action

`npm test` exercises the existing installed workflow before applying the additive
upgrade, then runs `supabase/tests/contributor-permissions.sql`. That suite tests
self-publish/live edit/unpublish, public projections, cross-author/viewer denial,
immutable identity/timestamps, image ownership, staff-only archival, republication
denial, own deletion, retained audit history and immediate role revocation.

The updated HTTP suite also checks real published-story uploads, no-store image
revocation and client Storage bypass denial. Its target guard forbids production.
From an authenticated local Supabase CLI, run:

```powershell
node scripts/run-fas-dev-tests.mjs
```

The runner obtains DEV keys privately in process memory; never paste them into
chat or commit a credential file. It creates disposable DEV identities/content,
runs the checks, signs out and cleans up exact recorded IDs/paths. It sends no mail.
Verify no synthetic accounts/stories/assets/audit remain after the run.

After a successful full run, apply the identical migration to PROD
(`vzdicnufhidelaoeqbza`), reconcile the native migration version only after checking
exact SQL hashes, compare policies/function definitions/grants with DEV, check
advisors, and run read-only production probes. Do not run fixture-writing tests in
production. Existing static stories remain file-backed and untouched.
