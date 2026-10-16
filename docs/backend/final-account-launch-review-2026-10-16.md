# Final viewer-account release review — 16 October 2026

Prepared for explicit publication/activation approval. Nothing in this document
or the SQL generator publishes, changes a hosted setting or opens registration.
The source registry still has a publication candidate and NULL active version.

## Ready and verified

- Production has all nine migrations, its signup validation hook, and the two
  reviewed cleanup schedules. The original administrator is preserved.
- The lifecycle function is deployed with custom identity/session verification
  and its separate production switch false. Six credential-free HTTP checks
  confirm disabled responses; enabled-mode production behavior is still untested.
- Approved confirmation/recovery subjects and exact HTML are installed. Both
  saved sources matched after reload. Exact HTTPS callbacks, one-hour expiry,
  verified Resend domain and tracking off are checked. No real email was sent;
  the complete From header still needs verification in the delivered message.
- Proposed main Privacy/Terms use the approved frozen candidate. Old public
  source and draft acknowledgements remain preserved. The age rule is 16+ as a
  site choice, not a universal claim about New Zealand law. No agreement is
  invented for the existing administrator. No blanket legal assurance is made.
- The local sidebar now provides Your account, using the existing style. It
  reaches account settings and its signed-out Sign in link. Profile searching,
  static-content reassignment, contributor licensing and future games remain
  separate work. Play My Path remains separate.

## Hosting settings actually observed

Read-only Cloudflare review confirmed fas-site-production uses main, builds
enabled, root /, build command npm run build:cloudflare-production and deploy
command npx wrangler deploy --config wrangler.production.jsonc. No build variables
or secrets are configured. Runtime variables cannot be added to this static-only
Worker; account configuration belongs in the build inputs, not runtime bindings.
The live domain link is fromastoryteller.com. No Cloudflare setting was saved.
The preview service must not receive production activation settings. The source
also omits account runtime configuration on non-main branch/PR builds, including
branch previews that inherit production inputs.

## Concrete next approval: publish the reviewed website and activate prerequisites

This approval would cover these actions, while **global signup stays OFF**:

1. Promote only account-launch-2026-10-16-v1 in the source registry to published
   and select it as active, preserving the frozen HTML and checksums. Run the
   launch checks and builds; no test draft is renamed or reinterpreted.
2. Finish PR #7 review/checks and merge its reviewed website changes to main.
   This publishes the new account pages, storage choices, About wording,
   Privacy/Terms, and account navigation already reviewed in this task. First
   deploy without enabling runtime account configuration. Verify main deployment
   and exact frozen policy bytes over HTTPS, rather than trusting a green preview.
3. Execute only supabase/ops/account-launch-2026-10-16-v1.sql after the public
   bytes match. It records the real transaction publication time, selects the
   exact version/hashes and requires future explicit agreements. It never adds
   a user's agreement. Retry preserves the original timestamp; conflicting
   content or another required release aborts. No schema migration is added.
4. Set the production lifecycle switch true and verify credential-free denials:
   missing/forged bearer, foreign origin and invalid receipt. If any protected
   request succeeds unexpectedly, switch it off and investigate before proceeding.
5. Set only these build inputs on fas-site-production's Production build settings:
   FAS_PRODUCTION_ACCOUNTS_ENABLED=true,
   FAS_PRODUCTION_LIFECYCLE_ENABLED=true, and FAS_PRODUCTION_PUBLIC_KEY containing
   the verified nonprivileged public key for the exact production project.
   Read the public key without printing/saving privileged keys. Never place a
   service-role/secret key in a browser build. Rebuild main and verify the generated
   no-store runtime file's origin/backend/release, live pages and disabled signup.
   The builder must reject missing/unpublished/mismatched configuration.

The global registration switch must remain off throughout these steps. Existing
accounts may sign in once the valid frontend is deployed; the original account
must explicitly accept any required Terms itself. This is a real website/policy
publication and protected-service activation, not another preview. Earlier
database/deployment/email approvals did not authorize this publication step.

## Separate manual stage: first public registration and real inbox test

Ryan must be present and explicitly approve opening global signup. Other people
can register while it is on; it is not a private or allowlisted test. Ryan enters
the password and age/Terms/Privacy confirmations himself. Then verify email
delivery and actual From header, confirmation, viewer-only role, sign-in/out,
revoked/expired session handling, recovery, profile correction and personal ZIP.
Confirmed deletion uses a separate disposable viewer and per-action confirmation.
Never delete the original administrator or assign static work to a test account.
Only call the viewer-account task complete after the real tests pass and any
defects are resolved. Production enabled-mode API testing remains part of this
stage; local/DEV results do not substitute for it.

## Stop and recover

If a release check fails, keep/turn new signup off and disable the frontend
account build input; turn the lifecycle switch off if relevant. Publish a fresh
verified disabled build. Preserve account rows, original agreements, snapshots
and publication time. Do not set the required release NULL to bypass agreements,
drop new tables, or automatically restore an old backup. Inspect unexpected
registrations before deciding on any further data action. Keep the encrypted
backup under the agreed retention process. Existing public reading must continue.

## Evidence and limits

The complete local suite passes, including SQL activation retry/conflict tests.
The SQL generator only writes the reviewed operations file; it has no network or
database calls. The source registry and hosted requirement remain inactive.
Latest pre-review commit 5ce7647 passed all three hosted checks and is mergeable;
new preparation changes require their own checks before approval is exercised.
Leaked-password screening remains off on the current Free plan; the known
default-deny/guarded-definer advisor notices remain explained in installation
notes. No paid plan, provider agreement or new credential has been accepted.
