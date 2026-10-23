# Your history: Recent Activity and Completed / Used / Played

Prepared feature; **not installed in hosted DEV or PROD**. Automatic approval review rejected the persistent database/retention installation. The remote DEV rehearsal ran in a transaction and rolled back, including fictional identities and the cron registration. Do not merge this frontend until the database and policy rollout below is approved and completed.

## Behaviour

`/account/history/` retains its identity and sidebar label. `?view=recent` and `?view=completed` are directly linkable sections with title/description search, content type, last-7/30-day filters, local date groups and 48-item cursor pages. Ordering uses visit/acknowledgement time, never publication dates. Older acknowledgements stay undated and sort last; unrelated saved/loved changes do not change acknowledgement time. Removing the explicit mark removes its completed entry.

Recent Activity is opt-in, account-private, and separate from anonymous analytics. Only a visible public content detail page records its canonical content path. Lists, search, account pages, private drafts, query strings, scroll positions, time spent and gameplay events are not recorded. One latest visit per stable content identity is retained, at most 500 pieces and 90 days. A visit never changes completion, save, favourite, follow, or game-save state.

Pause keeps existing visits. Remove and Clear affect recent visits only. Clear has a named confirmation; Escape/Keep activity cancel. Account-scoped serialization and a recording version prevent stale requests from reviving removed/cleared visits or writing after pause. The recorder makes one attempt per document and stops on account/session changes. Successful visits send the existing generic cross-tab invalidation signal with no personal data.

RLS is enabled without browser table grants. Authenticated invoker wrappers call bounded private helpers using `require_operator_session`, current public projections and existing account lifecycle locks. No caller-supplied owner ID is accepted. Private data clears from the interface on account changes; late responses cannot restore it. Foreign keys cascade on account/content deletion. Personal exports include settings/visits and completion timestamps; lifecycle snapshots include them for deletion consistency.

## Prepared rollout

1. Review and approve the explicit installation scope: two private tables, acknowledgement timestamp/trigger, six account RPCs, own-data export/snapshot integration and daily 90-day retention. No existing account is opted in and no historical visit is reconstructed.
2. `supabase/ops/viewer-recent-activity-prepared.sql` is reviewed source, not an applied migration. The local CLI could not create a migration because its telemetry file is outside writable paths. After approval, generate the migration with the supported CLI in a usable environment, copy this SQL into it and remove the extra prepared-SQL load from `tests/studio-database.test.mjs`. Alternatively use the approved hosted migration tool and persist its exact generated version, preserving the repository/DEV/PROD mapping. Do not fabricate an applied migration timestamp.
3. Apply/rehearse on hosted DEV, run `supabase/tests/viewer-activity.sql` (rollback-only), and verify fixture cleanup and advisors. Complete the current backup requirements before approved PROD installation. The six new RPCs must reject anonymous callers; both private tables must have no browser grants. Verify the retention job is active. It removes only expired recent visits and its own old cron logs.
4. Publish the reviewed frontend and frozen `viewer-activity-2026-10-24-v1` policy snapshots. Preserve all old policy snapshots/agreements. Verify exact live bytes before applying `supabase/ops/viewer-activity-2026-10-24-v1.sql` to DEV/PROD. This guarded transition must verify the exact viewer-actions predecessor and must not insert user consent. Recording still requires the separate explicit per-account opt-in.
5. Run the shared browser/build checks and `scripts/verify-content-layout-release.mjs --production-read-only` from the exact deployed revision. This verifies new frontend sources and anonymous RPC denial without production test identities.

Frontend rollback must preserve the new private records, timestamps, policy snapshots and current agreements. An old frontend can ignore additive tables; never reverse recorded policy acceptance or remove account history to roll back UI.

## Validation

`supabase/tests/viewer-activity.sql` covers default-off consent, public eligibility, query rejection, de-duplication, independent acknowledgements and stable dates, clear/remove/pause races, account isolation, exports/snapshots, retention, stable pagination, unavailable work, revoked sessions and deletion cascades. It passed in local PostgreSQL/PGlite and hosted DEV with rollback. No real account history or settings were changed.

`scripts/test-viewer-history-browser.mjs` exercises real modules with fictional RPCs at 1440/390/320px in both themes: opt-in/pause, canonical recording parameters, paging, filtering older matches, failed removal, clear cancellation/isolation, unknown dates, account clearing and delayed responses. Existing reader controls and discovery remain in the shared browser job. No In progress/resume feature or homepage change is included.
