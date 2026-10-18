# Story publishing and lifecycle

Task: **FAS | FAS Community V1 | Implement story publishing and lifecycle**.
Status: implementation and verification in progress; not yet installed in production.

## Contributor workflow

- Contributors publish stories/blog posts without approval after completing required metadata and selecting their own verified cover. Publish/unpublish require confirmation. Live edits remain immediate when explicitly saved.
- Archive removes a saved piece from public pages/listings, cancels scheduling and locks its editing. Save unsaved changes before archiving. This is a reversible author archive, separate from a staff moderation lock.
- Restore returns an author archive to a private, unscheduled draft. It does not publish. The author reviews requirements and explicitly republishes. IDs, covers and previously published addresses remain stable.
- Never-published, unscheduled drafts retain confirmed deletion. Previously published work must first be author-archived; permanent deletion requires a separate dialog and typing the current title. Export text, structured recovery files, and account story/image downloads before deletion as needed.
- Staff moderation locks cannot be restored or deleted by contributors. An administrator can release a moderation lock to a private draft, as before. A staff lock supersedes an author archive.
- Existing repository/file-backed stories, games and tools retain source-file lifecycle management; these controls apply to Community Studio manuscripts. Unsupported type editors are not introduced.

## Server enforcement

New migration: `supabase/migrations/20261018000428_story_publishing_lifecycle.sql`, generated using pinned Supabase CLI 2.120.0 in the isolated verification runner. Existing migration history remains unchanged.

The server-owned author_archived_at field distinguishes owner archives from moderation. Browser roles cannot insert/update it. The private lifecycle function verifies the current real session, active contributor/policy gate, owner, expected timestamp, valid transition and title confirmation, and locks the role/story rows. Its public wrapper is SECURITY INVOKER with explicit authenticated-only execution. New writes receive strictly increasing timestamps even within one transaction.

Direct DELETE policies now permit only never-published unscheduled drafts, including restrictive protection against accidentally broad future policies. Archived deletion is available only through the checked action. Previously published slugs are reserved on deletion, including account-deletion cascades, so another author's content cannot acquire an old permanent address. Moderation history retains a detached record as before.

Deleted story and asset records become unavailable immediately to public/owner projections. Private orphaned Storage bytes are not claimed as physically removed by this action; reference-aware cleanup remains the existing separate maintenance task. No uploads or real accounts are deleted for verification.

## Verification and rollout

Node/service tests, transactional PostgreSQL permission/visibility checks and fictional desktop/mobile browser rehearsals must pass before rollout. Hosted DEV fixtures run in rollback transactions. Verify unchanged production content before installing; deploy the additive database change before frontend sources that select the new column. Production installation follows the operations backup routine; no production mutation is performed by test fixtures.

Implementation/release evidence: pending.

## Public discovery

Published Studio stories/blog posts now join file-backed cards on home, category, related-content and search surfaces. `supabase/migrations/20261018001349_story_public_listing.sql` adds a paginated, published-only card projection behind an invoker wrapper; it contains no manuscript, private account ID, email or storage path. The browser fetches without credentials or Authorization, checks cursors to prevent loops, uses bounded request timeouts and reuses the current themed card renderer. Static content remains available if discovery is unavailable. Reader pages and profile listings retain their existing public-state checks and no-store responses.
