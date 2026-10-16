# Separate administrator permissions and tools

Work in progress, 17 October 2026 (New Zealand). Production is unchanged.

## Role model

Contributor (stored as member), moderator and admin are separate role rows with
a composite user/role key. Existing admin/moderator accounts gain an explicit
member row during migration to preserve the contribution rights they already had.
New admin grants do not add contributor access. Relinquishing admin leaves member
access untouched. Removing member access leaves administrative access untouched.
A viewer has no role rows. Public storyteller pages require member access or
published stories; admin-only accounts do not acquire a public profile by rank.

## Tools

- /account/admin/: invitation list/create/revoke; exact-email account lookup and
  independent contributor/admin grant/removal; story moderation and restoration;
  immutable invitation/access/moderation activity.
- /account/invitation/: verified matching account accepts a single-use contributor
  invitation. Tokens are in fragments, removed from the address before loading
  account services, and optionally retained in this tab for at most 24 hours to
  finish sign-in. An invitation is not policy acceptance and never grants admin.
- /tests/admin-preview/: fictional local demonstration. It never touches live
  accounts, roles, stories or invitations. Search alex@example.invalid.

Invitation links are displayed once for the operator to copy and privately share.
No email is sent automatically. Lost links must be revoked and reissued.

## Safeguards

Every admin RPC checks the caller's verified account, current database role,
account lifecycle and live auth.sessions record. An old access JWT from a revoked
session does not suffice. No editable Auth metadata supplies authorization.
Role changes additionally require the target's verified email to be typed and a
reason. Changes serialize with an advisory transaction lock. A database trigger
prevents deleting/reassigning the last active administrator, including accidental
trusted-side deletes. Users cannot directly insert/update/delete their roles.

Invitation issuance is limited to 20 per administrator per hour and refuses
another unexpired active invitation for the same email. Lists omit raw tokens
and hashes. Acceptance requires a current verified session, matching email,
expiry/revocation checks and an unconsumed token, locked against concurrent reuse.

Moderation archives the story and records the reason without rewriting text.
Only an admin can restore to private drafts, confirming the story reference and
reason. Restoration does not publish; the contributor chooses when to publish.
Regular contributors cannot restore staff-archived content themselves.

Audit rows live in a non-exposed private table with no client privileges. Admin
read facades return bounded pages and never include tokens. SQL workflow functions
have explicit execution ACLs and empty search paths. Staff account deletion still
uses its separate reviewed process. Account export remains compatible with
multiple roles; the archive retains a scalar role field for existing consumers.

## Verification / rollout

Migration 20261016214432_separate_admin_tools.sql is installed in DEV. Production
is unchanged. The initial full GitHub validation passed, including independent
roles, last-admin, invitation and moderation workflow tests. Re-run legacy
account/contributor APIs plus scripts/test-fas-admin-api.mjs through the guarded
node scripts/run-fas-dev-tests.mjs entry point. It forbids production targets.

Admin API fixtures use randomized .invalid emails and no messages. Their audit
records are intentionally not deletable by clients; the harness prints exact
synthetic audit, actor and subject IDs for independent native database cleanup.
Review those IDs and remove only their synthetic log rows, then verify zero
fixture accounts, invitations, stories and logs. A failed run must be inspected
before repeating, not treated as a clean pass.

Browser QA must cover both themes, narrow screens, confirmation/cancel behavior,
empty/error lists, role loss/account switches and invitation sign-in return.
The local command runner and browser are currently blocked by Windows sandbox
provisioning; GitHub and native Supabase remain available. Do not merge or deploy
the interface before required integration and UI checks pass.

Support scope is intentionally limited to account lookup, role management and
content moderation. It does not reveal passwords, impersonate users, rewrite
authors' work or delete another person's account through the browser.

Hosted DEV role/session/invitation transaction checks passed and rolled back all
fixtures. Independent counts verified zero synthetic accounts, invitations and
audit rows. Advisors show no ERROR-level findings; the private audit table
intentionally denies direct client access and checked admin RPCs intentionally
use SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
The pre-existing leaked-password-protection notice remains separate:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Follow-up migration 20261016214904_admin_image_session_guard.sql is also installed
in DEV. Existing image approval now requires the same live verified session and
records an audit action. Hosted stale-session approval denial passed. The legacy
security harness prints its synthetic subject IDs as well, because its invitation,
moderation and image actions now generate protected admin-audit records.
