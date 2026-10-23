# Your history: Recent Activity and Completed / Used / Played

## Default-on update (24 October 2026)

Ryan requested Recent Activity on by default for accounts. The follow-up release uses `viewer-activity-default-2026-10-24-v1` policy snapshots and migration `20261023201856_viewer_activity_default_on` (hosted DEV version). Accounts without a settings row now report enabled/version 0; their first recorder call creates the setting under the existing account lock. Every existing setting is preserved, including paused accounts. No visits are backfilled and no agreement is inserted. Pause/remove/clear version checks still reject stale writes. Cookie and anonymous analytics choices remain independent.

Release order: publish and verify the new policy snapshots and history interface, apply the guarded policy transition in `supabase/ops/viewer-activity-default-2026-10-24-v1.sql`, then apply the default-on migration to PROD. This keeps the disclosure live before the new default records visits. Preserve previous immutable snapshots and installed migration history. The original opt-in release notes below describe PR #93; this update supersedes its default-off behavior.

Validation: 243 automated tests, hosted DEV rollback fixture, and the real history/recorder browser suite at 1440/390/320px in both themes passed. The fixture now verifies automatic recording for an unset account and refusal after pause, while retaining isolation, retention, exports, deletion and stale-write checks.

Ryan explicitly approved deployment on 24 October 2026. The tested backend is installed in hosted DEV and PROD; the matching frontend and public policy rollout are in PR #93. No existing viewer is opted in and no historical visits are reconstructed. Final deployment and live verification evidence is recorded in PR #93.

| Target | Applied migration |
| --- | --- |
| Repository / hosted DEV | `20261023195546_viewer_recent_activity` |
| Hosted PROD | `20261023195646_viewer_recent_activity` |

Both environments have the same reviewed SQL. Private tables have no browser grants, and the daily retention job is active. The post-install production check found zero opt-ins and zero recent-visit records. Hosted DEV permission/lifecycle tests passed with rollback and no fictional identities retained. DEV retains its existing NULL policy requirement; the guarded published-policy transition below applies to PROD.

## Behaviour

`/account/history/` retains its identity and sidebar label. `?view=recent` and `?view=completed` are directly linkable sections with title/description search, content type, last-7/30-day filters, local date groups and 48-item cursor pages. Ordering uses visit/acknowledgement time, never publication dates. Older acknowledgements stay undated and sort last; unrelated saved/loved changes do not change acknowledgement time. Removing the explicit mark removes its completed entry.

Recent Activity is opt-in, account-private, and separate from anonymous analytics. Only a visible public content detail page records its canonical content path. Lists, search, account pages, private drafts, query strings, scroll positions, time spent and gameplay events are not recorded. One latest visit per stable content identity is retained, at most 500 pieces and 90 days. A visit never changes completion, save, favourite, follow, or game-save state.

Pause keeps existing visits. Remove and Clear affect recent visits only. Clear has a named confirmation; Escape/Keep activity cancel. Account-scoped serialization and a recording version prevent stale requests from reviving removed/cleared visits or writing after pause. The recorder makes one attempt per document and stops on account/session changes. Successful visits send the existing generic cross-tab invalidation signal with no personal data.

RLS is enabled without browser table grants. Authenticated invoker wrappers call bounded private helpers using `require_operator_session`, current public projections and existing account lifecycle locks. No caller-supplied owner ID is accepted. Private data clears from the interface on account changes; late responses cannot restore it. Foreign keys cascade on account/content deletion. Personal exports include settings/visits and completion timestamps; lifecycle snapshots include them for deletion consistency.

## Release and verification

The persistent installation includes two private tables, an acknowledgement timestamp/trigger, six account RPCs, own-data export/snapshot integration and daily 90-day retention. The actual hosted migration version is preserved in `supabase/migrations/20261023195546_viewer_recent_activity.sql`; the earlier prepared SQL was removed. Do not reapply the SQL to an installed environment or rewrite either migration history.

The frontend release publishes the frozen `viewer-activity-2026-10-24-v1` policy snapshots while preserving all earlier snapshots and agreements. Verify exact live bytes before applying `supabase/ops/viewer-activity-2026-10-24-v1.sql` to PROD. The guarded transition verifies the exact viewer-actions predecessor and inserts no user consent. Recording requires the separate per-account opt-in even after a policy agreement.

Run the shared browser/build checks and `scripts/verify-content-layout-release.mjs --production-read-only` from the exact deployed revision. This verifies new frontend sources and anonymous RPC denial without production test identities. The six new RPCs must reject anonymous callers; both private tables must have no browser grants. Check that `fas-recent-activity-retention` is active. It removes only expired recent visits and its own old cron logs.

Frontend rollback must preserve the new private records, timestamps, policy snapshots and current agreements. An old frontend can ignore additive tables; never reverse recorded policy acceptance or remove account history to roll back UI.

## Validation

`supabase/tests/viewer-activity.sql` covers default-off consent, public eligibility, query rejection, de-duplication, independent acknowledgements and stable dates, clear/remove/pause races, account isolation, exports/snapshots, retention, stable pagination, unavailable work, revoked sessions and deletion cascades. It passed in local PostgreSQL/PGlite and hosted DEV with rollback. No real account history or settings were changed.

`scripts/test-viewer-history-browser.mjs` exercises real modules with fictional RPCs at 1440/390/320px in both themes: opt-in/pause, canonical recording parameters, paging, filtering older matches, failed removal, clear cancellation/isolation, unknown dates, account clearing and delayed responses. Existing reader controls and discovery remain in the shared browser job. No In progress/resume feature or homepage change is included.
