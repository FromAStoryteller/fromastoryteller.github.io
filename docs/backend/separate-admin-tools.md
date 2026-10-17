# Separate administrator permissions and tools

Work in progress, 17 October 2026 (New Zealand). Production is unchanged.

## Role model

Contributor (stored as member) and admin are independent role rows with a composite user/role key. A viewer has neither role. Existing admins receive an explicit member row during the initial upgrade to preserve their former contribution rights. New admin grants do not add contributor access. Removing either role leaves the other unchanged.

Moderator is retired: no current DEV or production account uses it. A database constraint rejects new moderator assignments and staff authorization now means admin only. The historical enum label remains solely for migration compatibility; it grants no permissions.

Removing contributor access atomically returns published stories to private drafts and hides the public contributor profile. Text, image associations and uploaded originals remain owned by the same account and available through its content ZIP download. Reinstating access does not republish stories. Publication and contributor-role changes serialize per author so concurrent saves cannot leave revoked work public. Moderation archives remain archived.

## Tools

- /account/admin/: invitation list/create/revoke; a searchable account directory with role filters, sorting, 25-row pages and expandable labelled details;
  independent contributor/admin grant/removal; story moderation and restoration;
  immutable invitation/access/moderation activity.
- /account/invitation/: verified matching account accepts a single-use contributor
  invitation. Tokens are in fragments, removed from the address before loading
  account services, and optionally retained in this tab for at most 24 hours to
  finish sign-in. An invitation is not policy acceptance and never grants admin.
- /tests/admin-preview/: fictional local demonstration. It never touches live
  accounts, roles, stories or invitations. Browse 57 fictional accounts.

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

DEV additions: 20261017000835_admin_account_directory.sql and 20261017002148_retire_moderator_contributor_removal.sql. Native rolled-back regression checks verify bounded directory privacy, role retirement, public story/profile hiding, retained viewer-owned export snapshots and private reinstatement. Hosted HTTP regression now also checks the actual former-contributor ZIP. Production rollout remains pending that updated hosted run.
