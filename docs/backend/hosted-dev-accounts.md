# FAS development account rehearsal — 15 October 2026

This is a DEV rehearsal, not a public launch. Production and Play My Path were not changed. PR #7 remains draft. The static public/Cloudflare account pages remain disconnected.

## Changes applied

Ryan confirmed the fresh DEV archive was encrypted, tested and synced. The verified temporary unencrypted export was removed from the private work folder. The encrypted archive remains Ryan's responsibility under the 30-day replacement/removal process.

Only `20261015005917_account_lifecycle.sql` and `20261015015308_registration_declaration.sql` were pushed to `oqmmvjjycpyxvxipcyli`, after checking the exact dry-run list. All seven migration versions now match the repository. The existing operator identity and original stored image were preserved; stories/assets were empty before and after the tests.

DEV Auth now runs `public.fas_before_user_created`. Its execution remains denied to anon/authenticated and allowed to supabase_auth_admin. DEV email signup is enabled with confirmation required; anonymous sign-in and manual account linking remain disabled. Password policy is 12 minimum with lower/upper/digit/symbol requirements, secure email/password change enabled and one-hour email-link expiry.

The idempotent `supabase/ops/account-lifecycle-retention.sql` installed two DEV schedules: purge expired lifecycle records every 15 minutes and remove only these jobs' history older than seven days daily. This does not delete uploaded content or unrelated cron history. Verify actual backup expiry separately.

`fas-account-lifecycle` version 1 was deployed only to DEV, with an explicit `FAS_DEV_LIFECYCLE_ENABLED=true` opt-in. The entrypoint permits only local Kong or this exact DEV URL; production/unrecognized targets stay disabled even if the flag is set. Its browser origin is exactly the DEV loopback preview. Gateway JWT verification is disabled because the handler independently verifies the bearer with Auth, checks the actual session and identity before privileged actions, and supports a narrowly scoped deletion-status receipt after identity removal. Invalid sessions cannot invoke privileged RPCs. This exception is not an anonymous export/delete permission.

## Separate previews

- `npm run dev:accounts:local`: `http://127.0.0.1:55400`, local API/Mailpit, unchanged.
- `npm run dev:accounts:dev`: `http://127.0.0.1:55410`, hosted FAS DEV and real inbox delivery.

The DEV starter reads CLI keys into memory and passes only the verified anon key to Vite. No credentials are written to a file. The config endpoint rejects other hosts/cross-site callers, and browser configuration rejects mismatched loopback/backend pairs, production endpoints and privileged keys. Public hosted origins get no config.

DEV Site URL is the exact 55410 origin. Exact verification and recovery routes were added to the allowlist; the pre-existing localhost:5173 entry was preserved. DEV confirmation/recovery templates live in `supabase/templates/*-dev.html` and use fragment-only hashes, immediate callback scrubbing and explicit confirmation. Subjects are “Verify your From A Storyteller email” and “Reset your From A Storyteller password”. Test bodies identify development email; these are not production templates. SMTP credentials were not accessed or changed.

## Evidence and remaining work

66 automated tests passed. Reference/syntax checks and the 178-file preview build passed. `npm run test:accounts:dev` uses process-only CLI credentials and the fixed DEV target. It passed the seven existing API security groups plus declaration rejection, immutable registration record, viewer personal export, denied contributor export/escalation/cross-account writes, forged/cross-origin denial, password confirmation, explicit deletion, receipt and revoked login. Disposable accounts/files were cleaned; the original one account/one image remain. One image gateway 502 occurred on the first run; a focused retry and the complete subsequent suite passed. Do not conceal or treat a 5xx as a successful policy denial.

DEV advisors flag private RLS tables without browser policies (intentional default deny) and authenticated definer RPCs (intentional narrow self/staff checks, fixed search paths and tested roles). Leaked-password screening is disabled and the dashboard says it requires Pro or above. No paid plan was selected. Consider this protection before public launch: [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Advisor explanations: [default-deny tables](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [definer RPC review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Ryan completed real DEV signup, received the verification email, explicitly confirmed its link and successfully signed in. His screenshots show the clean callback address and success states. A read-only aggregate check confirms one verified account with the recorded draft declaration and no contributor/staff role. No email address, password or token is recorded in this evidence document. All three PR checks passed for fa9932f, including both Cloudflare branch previews.

Ryan also confirmed that actual recovery-email delivery, the recovery link, changing the password and sign-in with the new password worked. His screenshots show the recovery entry screen and successful sign-in. No password or recovery link was collected. The entry copy now explicitly identifies arrival from the recovery email and labels its action “Continue to password reset”; it does not claim the link is valid until Auth checks it. Spam-folder placement was not separately assessed.

Signup still records the local-draft acknowledgement version, not acceptance of future live Terms. Preserve/review final published policy versions and implement final agreement controls before launch. Provider/legal review, hosted restore/cutover, final account/username and explicit production enablement remain separate. Existing games/stories were not assigned to test accounts.
