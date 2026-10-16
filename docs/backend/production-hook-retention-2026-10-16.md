# Production signup validation and retention — 16 October 2026

Following Ryan's instruction to proceed with the account-service configuration,
production now has the enabled Before User Created Postgres hook:
public.fas_before_user_created. The dashboard applied only the displayed hook
permissions: execute/schema usage for supabase_auth_admin and execute revoked
from PUBLIC, anon and authenticated. SQL confirms those function grants and that
missing declarations are rejected. No identity was created to test the hook.
The production dashboard still shows signup, anonymous sign-in and manual linking
OFF, with email confirmation ON. No real agreement was submitted.

The reviewed supabase/ops/account-lifecycle-retention.sql installed pg_cron and
two active jobs: fas-account-lifecycle-retention every 15 minutes and
fas-account-lifecycle-cron-history daily at 03:37 in the database Cron timezone.
The first removes expired five-minute deletion intents, action-limit records
older than a day and completed deletion receipts older than 30 days. It does
not remove unfinished deletion work, accounts or uploaded content. The second
removes only these two jobs' run history older than seven days. Other jobs and
their history are outside its scope.

Catalog checks confirm both exact schedules and commands. The cleanup function
was invoked successfully after confirming all lifecycle work tables were empty.
This verifies invocation, not a completed scheduled run or deletion of aged
fixtures on production. No production fixtures were created. One user/admin,
zero agreements/releases and NULL policy requirement remain. The Auth audit
table has zero rows. These lifecycle schedules do not purge provider logs or
implement a new site-owned security audit stream; its agreed 30-day rule and
specific incident holds remain requirements if one is introduced.

## Deployment waiting for specific approval

Automatic approval review rejected the combined attempt to set the non-secret
production opt-in false and deploy fas-account-lifecycle with platform JWT
verification disabled. It cited persistent production configuration and public
endpoint exposure without explicit approval of that security-control choice.
The rejected shell command did not run. No opt-in was set and no lifecycle
function was deployed; the original fas-story-image v1 remains the only function.
No alternative tool or indirect workaround was used.

The intended handler performs custom authentication: it verifies a bearer with
Auth, checks a confirmed non-anonymous identity and live session before protected
RPCs, enforces ownership/roles and exact origin, and permits a narrowly scoped
secret deletion receipt after the identity is removed. Eight focused lifecycle/
production-adapter tests pass, including forged-token rejection and disabled-mode
denial. The outstanding confirmation identifies the public endpoint and disabled
platform check explicitly. Once approved, first set the lifecycle flag false,
deploy only this function and verify it stays unavailable. Do not infer approval
to open registration, publish policies or enable the website account adapter.

Advisors remain unchanged: eight intentional default-deny RLS tables, one public
policy-only definer reader, ten narrow authenticated definer functions and the
existing disabled leaked-password screening. See the database installation note
for explanations and remediation links. No screening plan purchase or credential
change occurred. Real production email/account/lifecycle testing remains pending.

References: [before-user-created hooks](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook),
[Cron](https://supabase.com/docs/guides/cron),
[function authentication](https://supabase.com/docs/guides/functions/auth).

The website, public signup and Play My Path were not changed.
