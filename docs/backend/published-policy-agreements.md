# Prospective policy agreement support — 15 October 2026

Ryan reviewed the policy wording and asked work to continue. That is operator wording review, not a registrant accepting Terms or legal certification. No policy release is published or required in DEV. Production was inspected read-only and has not received these changes.

## Installed in local FAS and DEV

Migrations `20261015032730_published_policy_agreements.sql` and `20261015034023_contribution_policy_gate.sql` add an empty private release catalog, a singleton NULL requirement, append-only per-account agreements, the Auth hook extension, public requirement lookup, self-only history and explicit existing-account acceptance. Both were applied only after exact dry-runs and SQL tests. The original registration declaration and its v1 notices remain separate. The DEV acknowledgement fingerprint, two accounts and one image were unchanged after installation.

Published releases store document IDs, exact paths, SHA-256 values and publication time. Review/future-dated releases cannot be required successfully. Catalog records cannot be updated/deleted through the normal workflow; publish a new release instead. Private tables have RLS and no browser table grants. `fas_current_policy_requirement` intentionally exposes only the current already-public release, never another person's agreement. Its anonymous SECURITY DEFINER advisory is expected and narrowly reviewed: [linter explanation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). Self-only definer RPCs check the caller and fixed search paths: [linter explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The before-user-created hook retains the original draft mode while no release is required. Once a published release is deliberately selected, it requires exact versions/hashes and actual JSON booleans for age, Terms agreement and Privacy-notice acknowledgement. An insert trigger checks again and records the release and server time. Trusted Auth provisioning is also rejected without the required declaration when that mode is selected; do not fabricate acceptance for an invited/admin-created person. A future pending-account invitation process must be reviewed before using that provisioning path under an active requirement.

Existing accounts are never backfilled or made to agree by metadata changes. The acceptance RPC has no user-ID parameter, verifies a confirmed identity and an actual current `auth.sessions` row, rejects closing accounts/stale versions, and preserves the original record on repeat submission. Browser roles cannot alter it. Auth deletion cascades the personal agreement rows; immutable policy documents remain as non-personal version history.

The contribution gate uses the existing story/asset/Storage write policies. When a release is required, contributors need its agreement before creating/editing/uploading content. Account roles are unchanged. Public/owned reads, profile correction, personal/content export, deletion and staff moderation remain available. This does not implement an additional contributor licence; public contribution launch remains separate.

## Browser and exports

`/account/agreements/` shows current versions and the caller's recorded history, or an accurate inactive/sign-in state. It presents unchecked age, Terms and Privacy confirmations only when a real requirement is returned. Signup similarly switches from test acknowledgement to separate published controls only when the server supplies a valid published release. Errors leave the form closed; arbitrary external policy URLs are rejected. The frontend does not publish a release or decide permissions.

Account settings link to this page. Personal exports are `fas-account-data-v3`, including self-only agreement history and readable version/time/hash details in My-account.txt. An empty published history is explicitly described as empty, not inferred from an old draft acknowledgement. Exports contain no passwords/session tokens.

## Verification

72 automated tests passed, including the full SQL/RLS suite. Real local PostgreSQL rollback tests verified publication/confirmation/hash checks, immutable history, isolation, session revocation, contribution denial/restoration, continued profile correction and deletion cascade. `test:policies:local` rehearsed synthetic agreement mode through actual local Auth/PostgREST: invalid public signup, valid signup without an authenticated session before email confirmation, explicit existing-account acceptance, repeat/metadata resistance, personal ZIP and deletion cleanup. Fixture identity/mail/release cleanup restored the requirement to NULL. Removing its synthetic immutable catalog row required an operator-only locked local transaction; that cleanup is never a browser RPC or hosted workflow.

Direct DEV account/security tests pass with no required release, including denial of invented agreement records. No actual user's Terms were accepted by automation. Production migration history remains at the five earlier security migrations and only its existing image function is deployed. Its signup/anonymous/manual-linking switches are off and email confirmation is on. Custom SMTP was already enabled with Resend, port 465 and 60-second per-user interval; no SMTP password was read or changed.

## Activation and recovery boundaries

Freeze actual published policy snapshots, validate checksums, configure the final release and rehearse activation before enabling live signup. Neither the reviewed v2 pages nor old test draft is silently promoted. The existing operator release-readiness check still refuses publication. Before selecting a production requirement, back up safely, verify provider/retention arrangements, prepare exact production callbacks/templates/configuration, test a restored isolated target, and obtain deliberate production rollout approval.

Backups must include all three new private policy tables and published document snapshots. On an empty restore target, restore releases before agreement rows; keep the requirement NULL while restoring Auth identities, then import original agreement rows with their recorded times and finally restore the reviewed requirement. Do not let signup triggers invent new acceptance on restore. Preserve the latest deletion ledger and omit/remove deleted identities' agreements. The earlier local restore rehearsal did not contain these newly introduced agreement records; a release containing them needs a new restore rehearsal before activation.

References: [Supabase Auth hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), [database functions and privileges](https://supabase.com/docs/guides/database/functions), [session model](https://supabase.com/docs/guides/auth/sessions).
