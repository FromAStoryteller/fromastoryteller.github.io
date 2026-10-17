# Admin tools release — 17 October 2026

PR #25 merged as ce2dfe70201707913407b82b64d2d24a59d8180b. The live /account/admin/ page loaded successfully with the existing operator session. Verified invitations, community counts, the account directory, labelled expandable details, retired moderator option, solid destructive controls, filter changes waiting for Apply filters, empty results, and Clear filters restoring the list. No real roles or content were changed during browser verification.

All 109 automated tests and validation/build checks passed (GitHub run 90). Ryan ran the complete guarded hosted DEV account/security/admin API suites successfully, including current role authorization, directory privacy, contributor removal and actual retained-content ZIP download, private reinstatement, invitation privacy and revoked sessions. Independently inspected and deleted only 19 exact synthetic audit rows (32–50, matching supplied subject IDs and null actors). Confirmed zero remaining synthetic accounts, stories, invitations and audit records.

## Database and function deployment

Four reviewed migrations applied to production through the native migration tool. Production generated its own history timestamps, retained without modification:

| Migration | Repository / DEV version | Production version |
| --- | --- | --- |
| separate_admin_tools | 20261016214432 | 20261017002724 |
| admin_image_session_guard | 20261016214904 | 20261017002737 |
| admin_account_directory | 20261017000835 | 20261017002747 |
| retire_moderator_contributor_removal | 20261017002148 | 20261017002757 |

These are the same reviewed SQL sources. Compared 11 key database function definition hashes across DEV and production: all match. Verified last-admin trigger, content-hiding trigger, supported-role constraint and anonymous directory denial. Production remains one Auth account, zero Community stories; the existing admin now has the explicit member role preserving its earlier publishing rights. Static site content was not imported or changed.

Production fas-account-lifecycle revision 3 is ACTIVE. Its package digest matches DEV revision 3: f21904b38a2aa21f1057f4a469f25172c1aa3f13d01c5428525fb9585380f331. It retains custom server-verified authentication, session checks and exact environment/origin guards. Its owner export supports former contributors.

Security advisors have no ERROR findings. Checked definer endpoints and private tables retain their intentional protections; the pre-existing leaked-password-protection notice is unchanged.

## Migration history and future operations

Automatic approval review rejected rewriting production migration-history timestamps, citing integrity/rollback risk without explicit metadata-mutation authorization. No metadata was changed and no workaround attempted. Keep the mapping above. Before any future CLI migration push/pull or repair, compare names, sources and this mapping; do not blindly replay these four already-installed migrations or automatically repair history.

## Operational outcome

Moderator is retired as an assignable/effective role; its historical enum label remains for compatibility. Removing member access makes published Community stories private drafts, hides the contributor profile and retains owner downloads. Reinstatement does not republish. Admin status remains independent. Friends are not granted access automatically; Ryan can manage grants in the tools.
