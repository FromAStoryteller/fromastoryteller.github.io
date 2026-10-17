# Stories-only Story Studio

Implementation and DEV verification: 17 October 2026 (New Zealand).

## Entry and scope

`/account/studio/` uses the existing account client, verified session restoration,
profile loader and current database role checks. Contributor account navigation
links to it. Viewer and admin-only accounts cannot enter. Admin controls remain
separate; administrators need an explicit contributor role to write here.

The editor supports title, plain-text story body, description/tagline, genre,
comma-separated tags, optional content warning, story address and cover selection.
It provides a private preview, word count, existing-story shelf with pagination,
new stories, draft autosave, explicit publication/live saving/unpublication and a
download of current editor text. Games, tools and other content types have no
creation controls or service paths in Studio. Existing file-backed stories remain
outside this editor; no content migration or import is performed.

Design uses the current shell, Literata reading face, Source Sans controls and
shared parchment, midnight, wine and gold theme tokens. Labels, native form
controls, visible focus, live save feedback, native expandable details and a
modal preview support keyboard and mobile use. Metadata/cover controls stack on
small screens. Both existing site themes apply.

## Save and privacy behavior

- New stories start as private drafts. Add a title to enable autosave after a
  1.8-second pause; explicit Save remains available. Draft autosave never publishes.
- Published changes do not autosave. Save live changes updates the public story
  immediately, preserving the previously agreed contributor workflow.
- Every update filters by verified owner, story ID and the exact previous
  `updated_at`. A stale version or zero-row update is a conflict, never success.
  Conflicts stop further writes until reopening; current text can be downloaded.
- Typing during a save is retained and remains unsaved until a subsequent save.
  Failed network saves leave the editor text intact. Drafts are not stored in
  browser local storage. Reloading can lose unsaved text; the page warns first.
- Sign-out also checks unsaved changes and waits for pending saves. Confirmed
  session end/account switching removes private UI and revokes image blob URLs.
- Contributor access/account state is checked on each service operation, every
  30 seconds while visible and when returning to the tab. Confirmed access loss
  clears Studio. Network verification failures preserve unsaved text for retry.
  The database independently enforces all existing permissions at request time.
- Staff-archived stories can be read, previewed and downloaded by their owner;
  editing and publication are disabled. Reinstatement remains an admin workflow
  and returns work to a private draft.
- Current policy acceptance remains enforced by the existing database write gate.
  Save errors link the explanation to connection and current account agreements.

## Cover boundary

The selector lists only assets registered to the current story. The database
validates the relationship independently. No cover is a supported selection.
Unapproved images can be selected but remain private; public story/profile
projections expose only approved images. Studio fetches private previews through
the existing checked, no-store image endpoint with the current session, never a
Storage public URL. Temporary browser blob URLs are revoked on story/access changes.

Image uploading, server-side image normalization/safety approval and trusted file
cleanup are a separate build. There is no upload or story-delete control here.
The current database has no real Community stories/assets, so cover selection
has been verified with synthetic fixtures. The UI clearly explains an empty list.

## Additive database change and migration mapping

Repository migration: `20261017024843_story_studio_metadata.sql` (created by CLI).
DEV native installed version: `20261017025709`, name `story_studio_metadata`.
Native timestamps are retained; do not repair history or blindly replay this
migration through a CLI push. Production is unchanged by this task.

Adds bounded `genre`, `tags` and `content_warning` columns to the existing RLS
protected `stories` table and grants only their insert/update columns. Existing
identity, ownership, moderation and policy triggers apply. The existing public
story projection adds metadata and approved cover information. It still checks
publication/account state and excludes private account fields and Storage paths.
Account export already uses the complete story row, so includes the new metadata.

## Verification and remaining release check

The complete automated suite, reference/syntax validation and static build pass.
`supabase/tests/story-studio.sql` passed in local PostgreSQL and hosted DEV inside
a rollback transaction. It checks metadata limits, private drafts, cross-owner
denials, viewer denial, public metadata, stale update filtering, unpublication
and moderation locking. Verified zero remaining synthetic accounts/stories.

Browser checks used explicitly labelled fictional data and covered desktop and
390px mobile layouts, both themes, draft autosave, private preview, save failure
text retention, publication, conflicts, private cover choice, moderation locks
and private UI removal after contributor revocation.

DEV security advisors show no ERROR findings. Existing checked public projections,
protected private tables and authenticated workflow notices remain intentional;
see [public projections](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
and [checked workflows](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
The pre-existing [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
notice is unchanged.

The Windows sandbox denies outbound Node requests with `EACCES`. Consequently the
full real Auth/PostgREST editor-service integration check has not passed here.
Run this from an authenticated local terminal in this checkout:

```powershell
node scripts/run-fas-dev-tests.mjs --studio-only
```

This fixes the target to hosted FAS DEV, obtains keys privately in process memory,
creates disposable accounts, sends no email, tests the actual Studio service and
removes/verifies its own fixtures. It never writes Storage bytes. The default
runner includes this check alongside the existing account/security/admin checks.
Those broader suites retain their documented exact-ID admin-audit cleanup step.

Before production release: pass this guarded API check, try an authenticated DEV
contributor in the browser, then install the identical additive migration in
production and deploy the reviewed interface. Keep the task in progress until
those integration/release checks are complete. Preview fixtures are excluded
from the deployment build.
