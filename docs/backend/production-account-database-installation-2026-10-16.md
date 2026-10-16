# Production account database installation

## Approved database installation — completed 16 October 2026

Ryan explicitly approved database migrations only. The exact four reviewed files
were installed in fas-community-prod with Vault updates skipped and no seed or
role import. Remote history now contains nine migrations; the follow-up dry run
reports no pending migrations.

Private in-memory comparisons confirmed the original Auth identity and role
fingerprints are unchanged, with one Auth user, one profile and one administrator,
zero stories and zero stored objects. Fingerprints/private values are not recorded
here. All public/private application tables have RLS enabled; no account private
table grants exist for PUBLIC/anon/authenticated. The signup hook is executable
by supabase_auth_admin, denied to anon/authenticated. Browser roles cannot invoke
privileged account snapshot/deletion functions. Buckets remain private, and the
story ownership/published-read and role-write restrictions remain installed.

Declarations, agreements and policy releases remain empty. The policy requirement
is NULL and the public requirement RPC returns NULL. Signup, anonymous sign-in
and manual linking remain OFF; email confirmation remains ON, verified in the
production dashboard without saving a setting. The hook was not configured,
no retention job or lifecycle function was deployed, no email sent and no website
merged/published. The existing administrator was not assigned an agreement.

Security advisors report intentional default-deny RLS tables (including invites),
the public policy-requirement reader, and narrow authenticated SECURITY DEFINER
functions. The public reader returns only a published release or NULL, never
personal agreements; authenticated operations retain self/staff/session checks.
These warnings were reviewed, not disabled. Existing leaked-password screening
remains off on the current Free plan; no upgrade was purchased.

References: [default-deny tables](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[public definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[password screening](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Validation is migration history, aggregate/fingerprint comparisons, live SQL
permissions/policy inspection and advisors. The six rollback suites previously
passed on the isolated backup restore; they were not run with fixtures against
production. Real production account/email/lifecycle behavior remains untested.
All three PR checks passed for source commit ec64184 before this evidence update.

Next stage requires separate approval: configure the production registration hook,
reviewed retention schedules and guarded lifecycle deployment, keeping signup off.
Website/policy publication and the first public registration window are later
separate steps. Play My Path was not accessed.

## Installed source checksums (UTF-8 LF)

- 20261015005917_account_lifecycle.sql: f0046049518c812d725608dc6d0066cf04f037443ec4647beb65228fa7c67272
- 20261015015308_registration_declaration.sql: 4a0e7f8d28059035003c25a778d84f0660aaea32b7907fb42b1151558008ca4b
- 20261015032730_published_policy_agreements.sql: ccffc86171218fbcfca9dff40e2486ac18eaaed88da0fc55ec46e62460a99148
- 20261015034023_contribution_policy_gate.sql: 1e99f05d73546fc110d3a1daf1d73859c66d44118c7108eee784008f75b30008
