# Saved content history

Studio keeps up to 20 replaced versions per previously published content item from this feature onward. New content versions are captured transactionally when editable content changes. Status-only, cover-only and image-description updates do not create manuscript versions. Permanently deleting a story removes its history. Account deletion removes owned history, including file-player history, through the profile foreign key.

Private revisions contain manuscript/presentation metadata or the complete interactive package, including JS, CSS and embedded assets. The original legacy player is represented by a null package and falls back to the checked-in project. Both upsert paths and restore-to-original retain the replaced version. Original projects must remain available at their existing content/legacy-projects paths.

History RPCs require a current verified operator session, contributor membership, active account, current agreements and current owner/shared-FAS permission. Tool history also requires admin access. Public wrappers are security invokers. Private tables have RLS and no browser table grants. FAS access never transfers authorship.

Studio restore uses the standard conditional save path, preserving the current URL, original owner, cover, visibility and publishing identity. Archived/moderated stories remain locked. Current metadata and package validation still apply. Games with different account-save or multiplayer settings must be downloaded, adapted and uploaded rather than restored directly. Existing player saves are never overwritten by restoring source files. Room version checks invalidate old live rooms as for any other saved game update.

Owned-content exports include metadata/content-revisions.json. Existing bounded export limits still apply; larger archives require the support export process. Individual retained source versions can be downloaded from Studio. Account lifecycle deployment must include the updated handler.

Deployment: apply the additive published_content_history migration, deploy fas-account-lifecycle, publish the matching site and immutable studio-history-2026-10-20-v1 notices, verify their public hashes, then execute the guarded policy transition in supabase/ops. Do not create acceptance records or mutate earlier policy snapshots. Transactional fixtures in supabase/tests/content-history.sql are for DEV/local only.
