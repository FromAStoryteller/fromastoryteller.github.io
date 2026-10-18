# Story publishing and lifecycle

Task: **FAS | FAS Community V1 | Implement story publishing and lifecycle**.
Status: **complete and deployed** on 18 October 2026 (Auckland).

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

Node/service tests, transactional PostgreSQL permission/visibility checks and fictional desktop/mobile browser rehearsals must pass before rollout. Hosted DEV fixtures run in rollback transactions. Verify unchanged production content before installing; deploy the additive database change before frontend sources that select the new column. The operator requested backups be deferred for this work. The existing confirmed encrypted archive remains recorded in operations; no new backup or restore rehearsal is claimed. These migrations are additive schema/function/policy changes, not content deletion. Pre/post production fingerprints verified unchanged stories, cover records, profiles and file content. Test fixtures ran only in the test engine/DEV rollback transactions.

[PR #39](https://github.com/FromAStoryteller/fromastoryteller.github.io/pull/39) merged as `59194455b8e48b071a5d59708d7ff551c58e1643`. The final feature [build 117541548872](https://github.com/FromAStoryteller/fromastoryteller.github.io/actions/runs/39082286972/job/117541548872) passed **155 Node tests**, including PostgreSQL lifecycle/public-discovery assertions, real codec smoke checks, reference/syntax/index validation and Worker bundling. [Chromium job 117541842867](https://github.com/FromAStoryteller/fromastoryteller.github.io/actions/runs/39082385132/job/117541842867) passed **18 scenarios**: 11 recovery plus seven lifecycle/discovery cases. Fictional tests covered native confirmation cancellation/title validation, owner restore, moderation locks, schedule cancellation, failed/stale actions, mobile fit, and home/category/search appearance and withdrawal. Harness sources are retained on `verify/story-publishing-lifecycle`, separate from published source.

Hosted DEV transactional tests passed for owner/other-contributor/viewer/anonymous/session rejection, server-owned archive state, unpublish/archive public removal, explicit republish, private unscheduled restore, moderation supersession, direct-delete restrictions, deletion/audit/address retention and equal-time pagination. All fixture accounts/content rolled back. DEV retained its existing one story, one asset, two accounts and 14 file items; story/asset fingerprints match pre-migration values.

| Repository migration | DEV installed version | Production installed version |
| --- | --- | --- |
| 20261018000428_story_publishing_lifecycle.sql | 20261018001002 | 20261018002308 |
| 20261018001349_story_public_listing.sql | 20261018001845 | 20261018002324 |

Keep applied files/history immutable; filenames and installed timestamps intentionally retain these mappings. Do not repair the timestamps by replaying migrations.

Production function-body fingerprints match DEV. Real ACL checks confirm anonymous lifecycle execution is denied, authenticated execution is granted only through guarded functions, the archive flag cannot be inserted/updated by authenticated clients, and public discovery remains anonymous-readable. Security advisor categories/counts remain unchanged: intentionally protected private [RLS tables](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), existing checked [anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)/[authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) function workflows, and the pre-existing [password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Production [deployment 117542789198](https://github.com/FromAStoryteller/fromastoryteller.github.io/runs/117542789198) and main checks succeeded. Read-only [live verification 117542746051](https://github.com/FromAStoryteller/fromastoryteller.github.io/actions/runs/39082686296/job/117542746051) matched exact reviewed editor/service/catalog/content-system/styles, checked Studio/home/category/search shells, called the real published-only anonymous catalog, verified HTTP permission denial for anonymous lifecycle actions, and checked all 14 existing public file pages and bylines. Verification sources are retained on `verify/live-story-lifecycle`. No signed-in session or production content mutation was used for testing.

Immediately before/after installation, production retained zero Community stories/assets, one account and 14 file items. File-content/profile fingerprints were unchanged. No existing stories, games, tools, identities or publication states were changed by the rollout.

Rollback: revert frontend source if needed while retaining the compatible additive backend and tightened deletion rules. Do not drop archive markers, reservation records or applied migration history; use a tested forward migration for backend corrections. Physical Storage cleanup and a full hosted restore rehearsal remain separate.

## Public discovery

Published Studio stories/blog posts now join file-backed cards on home, category, related-content and search surfaces. `supabase/migrations/20261018001349_story_public_listing.sql` adds a paginated, published-only card projection behind an invoker wrapper; it contains no manuscript, private account ID, email or storage path. The browser fetches without credentials or Authorization, checks cursors to prevent loops, uses bounded request timeouts and reuses the current themed card renderer. Static content remains available if discovery is unavailable. Reader pages and profile listings retain their existing public-state checks and no-store responses.
