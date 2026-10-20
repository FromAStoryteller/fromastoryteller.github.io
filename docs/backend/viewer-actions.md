# Viewer actions and private collections

Viewer accounts can independently save, acknowledge and love published content. Each action is reversible and idempotent: one current boolean per account and stable content ID. Stories/blog/video use Saved for later; repeat-use games/tools use Favourites. Manual acknowledgements say Read, Played, Used, Watched or Listened. They are voluntary, not verified completion.

Save controls sit below detail headers and beneath grid-card images as separate buttons outside the content link. Acknowledgement and Loved it sit below the work, before Explore Next. Buttons expose aria-pressed, keyboard focus, text state and errors. Cards show the viewer's own acknowledgement. No public totals, popularity sorting, notifications or saved/favourite counts are added.

Private account pages are /account/saved/ and /account/favourites/, available from the header and account navigation. Newest saved first, 48 per page with a stable cursor. Unavailable content is excluded using the existing public projections, so private drafts, archived work and closed contributors are not exposed. An unpublished item's choices can return if it is published again.

## Security and data lifecycle

private.viewer_content_actions has RLS enabled and no browser table grants. Account RPC wrappers are invokers; narrowly granted private definer helpers require a verified active server-side session. No caller-supplied account IDs are accepted. Mutations serialize per account using the existing account-lifecycle advisory-lock key. Foreign keys remove choices when their account or content is permanently deleted.

Public content lookup resolves indexed UUIDs/slugs/URLs; it does not trust card metadata for publication eligibility. Read batches allow at most 100 keys. Every write sets only one supported boolean; duplicate clicks cannot increase a count. There is no third-party analytics dependency or anonymous visitor identifier.

Only an active contributor receives all-time current acknowledgement/Loved it totals for their owned pieces, including FAS bylines. Ownership, not displayed publishing identity, determines attribution. No viewer IDs, email addresses or save counts are returned. The time-period picker still applies to audience views; acknowledgement totals are explicitly labelled all time and separate.

Personal account downloads include all owned raw choices via fas_my_viewer_data, including choices for temporarily unavailable content. The privileged content snapshot includes viewer_actions for lifecycle consistency. The existing contributor ZIP remains about contributor files; viewers use the personal account-data download. No Edge Function deployment is needed for these database-backed additions.

The viewer-actions-2026-10-20-v1 policy snapshots disclose requested storage, private aggregates, export/deletion and availability limits. Preserve all earlier releases. Apply the guarded policy transition only after exact production snapshot hashes are verified; never invent an agreement.

## Verification

supabase/tests/viewer-actions.sql runs inside a rollback-only transaction with fictional identities. It exercises anonymous denial, session revocation, independent/idempotent actions, cross-account privacy, draft/archive protection, file/studio sources, owner-only aggregates, pagination, exports and deletion cascades. It is run by tests/studio-database.test.mjs and against hosted DEV before production migration.

scripts/test-viewer-actions-browser.mjs uses actual public layouts/modules with fictional account RPCs. It covers desktop/phone and both themes, failure state, independent toggles, card saves without navigation, acknowledgement position, repeat-use wording, collection behavior and session clearing. No real viewer actions or analytics counts are created.
