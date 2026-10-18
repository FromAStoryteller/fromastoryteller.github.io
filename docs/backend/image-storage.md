# Image storage and uploads

Community V1 covers and profile images use the private `fas-story-images` bucket.
No contributor approval is required. Static site artwork remains source managed.

## Writer controls

- Covers: JPEG/PNG input, at most 5 MiB and 8 million pixels; movable 16:9 crop,
  saved as a fresh 1600 × 900 JPEG. A nonblank description up to 500 characters
  is required. The cover is required to publish or schedule.
- Profile images: optional, available to verified active viewers and contributors.
  The same input limits apply. A movable square crop is saved at 512 × 512.
  The display name supplies a default accessible description that can be edited.
  Images and descriptions save separately from profile text.
- Both crops support dragging and labelled horizontal/vertical sliders. Sliders
  that cannot move the current image are disabled. Controls fit mobile layouts.
- Studio's Cover tab includes Manage attached images: edit a description or remove
  an unused image with confirmation. Selected images cannot be removed. Save a
  replacement first, or clear an unscheduled draft's selection and save.
  Previous covers remain attached choices until explicitly removed.
- Removing a profile image requires confirmation. Stale image versions and expired
  sessions never overwrite a newer image. Reload saved image refreshes its version
  without discarding unsaved profile text.

## Security and references

Browser input is untrusted. Edge handlers bound the body, reject unsupported or
duplicate form fields, verify Auth and session IDs, check owner/editability, decode
and re-encode using the pinned Imagescript Deno WASM codec, and verify JPEG output
dimensions before storing. Original metadata and uncropped input aren't retained.
Combined profile/cover uploads are limited to 20 attempts per account per hour.

Paths are immutable owner/subject/random-UUID.jpg values. Storage INSERT from
ordinary browsers is closed, and no browser UPDATE/DELETE policy permits overwrites.
A trusted reservation precedes the byte write. Registration rechecks the actual
session, policy agreements, account state and target ownership after the upload.

A failed or lost response must not delete an image that registered successfully.
Abandoning an upload retires only its pending, unreferenced reservation. Crashed
uploads become eligible after one hour, or after their owner account is removed.

Cover reads retain existing publication/RLS rules: only the selected cover of active
published content is public. Profile images are public only for active contributors;
viewer images require their owner. The profile visibility API returns a boolean;
private paths are resolved separately by the service role. Delivery checks visibility
before fetching and again after buffering. All responses disable browser/CDN caching,
set nosniff, and never return signed Storage URLs.

## Removal and retries

Deleting an attached cover, replacing/removing a profile image, permanently deleting
a story, or removing an account queues the exact retired path in a private table.
A tombstone prevents reuse. Cleanup refuses any path still referenced by ANY story
asset or profile, claims at most 25 objects, and deletes bytes through the Storage
API. Only a matching successful claim can be acknowledged. Failures retain a
five-minute lease for retry. No broad bucket/prefix deletion is used.

The five-minute `fas-image-cleanup` Cron job uses pg_net and a short-lived, one-use
token, rather than keeping a service key in Cron or Vault. The Edge endpoint verifies
and consumes the token using its built-in service credentials. Postgres never deletes
Storage metadata directly. Completed cleanup/reservation records expire after 30 days.
Pending records do not expire until the byte deletion succeeds.

The bucket remains covered by the existing SHA-256 Storage backup utility. Account
content ZIPs include profile-image metadata and stored crop bytes, including viewer
images. Export stability includes profile changes; missing referenced images fail
the export. Account removal collects all owned bucket objects, regardless of whether
they are profile or cover images.

## Operations and validation

Apply the image migrations in filename order; deploy the upload, delivery, cleanup
and account-lifecycle functions; configure exactly the matching project's base URL
in private.image_cleanup_config. Source timestamps were generated with pinned
Supabase CLI 2.120.0 on isolated verification branches. Hosted migration timestamps
are recorded in the release evidence.

Run `npm test` and the actual Deno normalizer test. The image PostgreSQL fixtures
run through the Studio database suite; the historical security rehearsal deliberately
skips later feature migrations and the current suite applies all migrations.
The service-role wrapper calls are tested explicitly as that role.

Browser verification uses fictional profile fixtures at desktop and mobile sizes,
plus the existing Studio recovery and lifecycle suites. Hosted verification creates
only named disposable DEV accounts and files, checks physical Storage bytes,
cross-account denial, public/private visibility, stale edits, session expiry,
export and cleanup, and removes every fixture in finally. No PROD fixtures are used.

Rollback should restore the previous frontend/Edge release first; retain image data
and additive schema. Never restore a function that bypasses pending reservations
while cleanup is enabled. Do not drop the cleanup tables or revert raw Storage grants
to work around a failed upload. Inspect private pending counts and Cron/HTTP status,
repair the cause, then retry the worker.

## Release evidence — 18 October 2026

Feature PR #41 merged as `035bd93d700f73a6e27625608713c166228f7e55`.
Reviewed feature head: `8fe8b8d919b550e183b0fe93b8010e3efdfd1022`.

| Repository migration | DEV installed version | PROD installed version |
| --- | --- | --- |
| 20261018003403_image_storage_uploads.sql | 20261018004331 | 20261018005240 |
| 20261018003404_image_cleanup_schedule.sql | 20261018004349 | 20261018005258 |
| 20261018004738_image_service_access.sql | 20261018004837 | 20261018005316 |

Migration names were generated by CLI jobs 117544324910 and 117546845918.
The third additive migration fixes hosted service-role schema access and reinstalls
only the newly introduced pg_net extension under extensions. No pre-existing net
extension or third-party network jobs were present in either project.

Feature CI job 117547714085 passed all 162 Node/PGlite tests, two actual Deno WASM
codec tests, policy/reference/index checks and the Worker build. Browser job
117547426239 (run 39084264077, branch verify/image-storage-browser) passed 23 scenarios:
profile and cover controls at 1440/390px, viewer disclosure, and all 18 recovery/
lifecycle/discovery regressions. Its artifact includes screenshots and has digest
`sha256:9b05e3e4ff857dcc6377490488bac0d3749e5921e8440476c3d1c030c8368074`.

Hosted DEV transaction fixtures passed with the real service role. A one-use-token
DEV verifier passed 27 real API/Storage checks, including real 1600×900 and 512×512
bytes, private/public access, cross-owner denial, raw Storage-write denial, selected
reference protection, stale replacement, actual replacement byte deletion, alt
changes, viewer ZIP export and session revocation. The verifier's finally removed
all three disposable accounts and their bytes; its endpoint is now disabled (410).
Reproducible verifier source is retained only on the verification branch.

DEV baseline after cleanup: 1 story, 1 asset, 2 profiles and 2 stored objects.
Existing story hash `1e68b14ae2a863b466f17db6773a0c40` and asset hash
`70ed9509eddbb02104841ae532a992c9` are unchanged. No pending cleanup remains.
PROD retains 0 Community stories/assets, 1 profile and 0 stored objects. No PROD test
accounts or uploads were created.

All six image/account functions are active on DEV and PROD. Production's five-minute
cleanup job is enabled and both initial and scheduled HTTP runs returned 200 with
zero pending work. Both projects retain the existing advisor findings: five
intentional anonymous and 31 authenticated public SECURITY DEFINER APIs plus the
existing password-protection notice. Four new inaccessible private RLS tables add
informational notices; no new security warnings remain.

This rollout follows the user's explicit instruction to complete the updates and
make backups later. Migrations did not remove any existing byte or content rows.
Physical deletion tests targeted only named disposable DEV fixtures.

Live read-only verification job 117548731869 (run 39084705177, branch
verify/live-image-storage) passed exact comparisons for ten live source files,
canonical profile/settings/Studio shells, anonymous published-only discovery,
all 14 public file pages and bylines, uncached missing-image responses, denial
of anonymous upload/profile-write/cleanup calls, and the public profile image
projection. It used no signed-in session or content mutation.
Production build/deploy checks succeeded. Save any open edits before refreshing
the Profile or Studio page to load the new controls.
