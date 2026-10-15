# Local content export and confirmed deletion

This records the original isolated local FAS implementation and its tests.
It has since been deployed to the explicitly allowed FAS DEV project; see
[current DEV status](hosted-dev-accounts.md). Production remains disabled.
Keep Play My Path separate.

## User flow

1. Sign in and open Account settings.
2. Contributors can use Download my content to produce a ZIP containing account/profile details, all owned
   Community story text (including drafts/published work), image metadata and original
   uploaded images, including owned uploads not registered to an asset yet. JSON
   metadata is kept separately from readable story text.
3. Delete account opens a current-password check. Review deletion verifies that
   password and shows the number of owned stories, published stories and images.
4. The user must acknowledge the offered export and type DELETE before the final
   confirmation. Cancel at this stage does not remove anything.
5. Confirmation removes owned content/files and the login, then clears the tab's
   session. A failed/uncertain response never reports success without checking the
   deletion receipt. Once removal starts, closing the form does not undo it.

The complete-content scope is the current account-owned Community model. Existing
static games/stories have not been assigned to these accounts and are not exported
or deleted. Future game saves, account-owned games and multiplayer require a versioned
extension before those features launch; see [future game data](future-game-account-data.md).
Never label this as exporting data from features that do not exist yet.

## Server controls

- Auth verifies the bearer token; a database check then verifies that its session
  belongs to the same account and has not expired. Caller-supplied target IDs and
  editable metadata cannot choose the account to export/delete.
- Privileged lifecycle RPCs grant execution only to service_role. The only public
  authenticated status RPC takes no user ID and returns the caller's own active/
  closing state. Private workflow tables have RLS and no client grants/policies.
- Five export attempts/minute and five password-confirmation attempts/10 minutes
  per account are enforced in the database, alongside Auth password rate limits.
- Password reauthentication creates a temporary session which is signed out and
  never returned or persisted. Confirmation tokens stay in memory; only their
  hashes are stored. Confirmations are bound to the account/session and expire in
  five minutes. Staff accounts and prior cross-author staff approvals require a
  separate reviewed removal path.
- A short transaction locks relevant writers, records the deletion job, removes
  owned story/audit rows and account-linked invites, and freezes further writes.
  Public reads also exclude closing authors. Network calls occur outside locks.
- Storage files are removed through the Storage API, not by deleting Storage SQL
  rows. Each successful batch is acknowledged, permitting retries. The Auth API
  removes the login only after content/file cleanup; completion rechecks identity
  and owned-file absence. Access JWTs may still have nominal time left, but session
  checks and closing-account RLS prevent protected operations.
- A secret receipt can verify completion after the identity is gone or the final
  response was lost. It reveals only pending/complete/unknown, not private content.
- Original bytes are fetched only by the server for verified ownership; response
  headers prevent browser/CDN caching. The snapshot is checked again before export
  completes. Missing/changed originals fail clearly with no deletion.
- Preview ZIPs are bounded: 300 stories, 500 assets/uploads, 16 MiB of story bodies
  and 32 MiB of archive payload. Larger exports require a background/support flow;
  the service refuses a partial export. Generated archive paths use UUIDs and are
  validated against traversal/duplicate names. No passwords, tokens or other users'
  content are exported.

New profiles also initialise the chosen cosmetic display name from validated
string metadata. Metadata still grants no contributor/staff privileges.

## Retention and restore requirements

`supabase/ops/account-lifecycle-retention.sql` was applied **locally only**. It checks
for the FAS lifecycle schema, enables pg_cron, expires confirmation/rate-limit rows,
purges completed deletion receipts after their 30-day retention threshold and cleans
only this workflow's Cron history after seven days. The receipt sweep runs every
15 minutes; it does not delete uploaded content or manage Dropbox archives.

Ryan selected removal of deleted-account data from backup copies within 30 days,
including manual archives. That operational commitment still needs a verified
hosted schedule and archive inventory before public deletion is enabled.

Before any restore, securely preserve the current deletion ledger separately from
the backup being restored. Reapply that ledger before opening Auth/public APIs,
then replay cleanup of restored identities, content and original bytes. Never let
an older backup overwrite the only copy of current deletion records. RLS keeps
restored publications from closing accounts hidden while cleanup is reapplied.
The SQL tests simulate this restoration and confirm that cleanup can be resumed.
A subsequent isolated local rehearsal with real Auth rows and Storage bytes passed; see [local restore rehearsal](local-restore-rehearsal.md). It does not validate a full hosted backup import or production cutover. Do not describe the earlier pre-account backup test as proving the account lifecycle.

## Verification and running locally

`npm run dev:accounts:local` starts Vite and the local function server, capturing
CLI status privately. The browser receives only the anon key, never service_role.
Use the existing local stack/migrations; no production target is accepted by tests.

`npm run test:lifecycle:local` needs process-only `FAS_TEST_ANON_KEY`,
`FAS_TEST_SERVICE_KEY`, `FAS_TEST_CONFIRM=LOCAL-FAS-ONLY`, and a trusted Python path
in `FAS_TEST_PYTHON` for independent ZIP verification. Tests create/delete disposable
accounts, drafts/publications/images and inspect two-user isolation. They check
missing originals, wrong passwords, staff denial, expired sessions, direct-RPC
denial, export acknowledgement, interrupted file cleanup/retry and receipt checks.
The PostgreSQL-engine suite checks ACLs, expiry, rate limits, freeze/read gates,
restore replay and receipt retention. It does not substitute for real Auth/Storage
API tests. The original seven-group local security suite also passes.

The browser verified an actual ZIP download containing two sample stories and one
original image, password review and cancellation without deletion. Final permanent
deletion in the browser awaits the user's action-time confirmation on a disposable
local fixture. All automated lifecycle fixtures were cleaned up.

Before hosted rollout: review migration/function code, choose an explicit hosted
enablement/configuration, apply the retention schedule in the selected FAS dev
project, test real email and the full deletion/restore path there, finish age/Terms
controls and policy/provider review, then seek deliberate production approval.

## Download access and readable formats

Every signed-in account can download personal account/profile data as a ZIP with My-account.txt and metadata/account.json. This export deliberately excludes story content and credentials. Contributor content is offered only for member/moderator/admin roles, with the same eligibility checked server-side from the database role. Viewers receive HTTP 403 for a direct content-export request.

Content ZIPs include README.txt, readable stories/*.txt, original images/* and metadata/*.json for imports and image/story associations. Story text is preserved as entered, so formatting markup may remain visible. UUIDs keep filenames unique. No future save or multiplayer data is claimed.
