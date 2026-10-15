# Production account rollout preparation — 16 October 2026

Status: prepared work only; not a production rollout. Ryan approved the production
verification/recovery email wording in the local viewer on 16 October. No message
was sent, production template installed, credential changed or signup enabled.

Latest: Ryan also approved the branded launch policy candidate wording. The
[read-only production readiness review](production-readiness-2026-10-16.md)
records the actual missing callbacks/hook/lifecycle/schedules, fresh backup and
later rollout order. Backup encryption/test/sync is the next manual step.

## Prepared email settings

The source of the intended values is
`supabase/templates/production-email-settings.json`. It contains no secret.

| Setting | Intended production value |
| --- | --- |
| Project | fas-community-prod, vzdicnufhidelaoeqbza |
| Site URL | https://fromastoryteller.com |
| Confirm signup subject | Verify your From A Storyteller email |
| Confirm signup body | supabase/templates/confirmation-production.html |
| Reset password subject | Reset your From A Storyteller password |
| Reset password body | supabase/templates/recovery-production.html |
| Link lifetime | 3600 seconds; verify the actual Auth setting before using wording promising one hour |
| Expected callback paths | /account/verify-email/ and /account/reset-password/ on the exact HTTPS site origin |
| Provider tracking | Open and click tracking off; verify actual sending-account settings |

Both token links use SiteURL with TokenHash in the fragment. They do not use
editable user metadata or a user-provided redirect. They lead to the site's
existing explicit confirmation/recovery step, rather than consuming credentials
on the email provider's redirect. Never add real sample tokens to Git, screenshots
or the review page. DEV/local templates retain their labels and existing bindings.

The review page at `/account/email-review/` is generated from these templates with
all email links removed and two sandboxed frames. Regenerate it with
`node scripts/preview-fas-production-emails.mjs` after editing a template, then run
site validation so its shell matches the site. Browser rendering is a visual
preview, not proof of Gmail/Outlook delivery, multipart text or inbox placement.
Inspect an actual delivered message during the later controlled smoke test.

## Concrete work still required before rollout approval

1. **Production adapter — implemented, inactive.** The exact HTTPS live origin can
   now load generated account/runtime-config.json. Missing, redirected, malformed,
   wrong-project or privileged-key configuration stays closed. DEV/local origins
   continue using their separate middleware; workers.dev and foreign origins cannot
   load the production adapter. Signup requires a current published server release
   matching the build's policyRelease. No runtime configuration is tracked or emitted
   by ordinary builds. Verified production mode uses viewer-facing wording instead
   of DEV/test labels. Existing draft acknowledgements remain separate.
2. **Lifecycle adapter — implemented, inactive.** The browser and Edge Function
   now support only the exact production backend/origin, with a distinct server
   FAS_PRODUCTION_LIFECYCLE_ENABLED switch. The DEV switch cannot enable it.
   Invalid browser destinations are rejected before session refresh or transmission.
   Server identity/session/ownership/role checks are unchanged. The production
   function has not been deployed or enabled; actual production lifecycle testing
   remains a rollout prerequisite.
3. **Final policy release.** Prepare final published wording/snapshots, preserve
   the reviewed and acknowledged drafts, verify hashes and create the deliberate
   release record. Keep the requirement NULL until the matching documents and
   server controls are ready. No actual user agreement may be backfilled or
   fabricated for an operator-created account. Invitation/contributor licensing
   remains separate from viewer signup.
4. **Review the production change set.** Production still has the original five
   security migrations. The intended additional migrations are
   `20261015005917_account_lifecycle.sql`,
   `20261015015308_registration_declaration.sql`,
   `20261015032730_published_policy_agreements.sql` and
   `20261015034023_contribution_policy_gate.sql`.
   Recheck remote history and exact dry-run output at rollout, rather than assuming
   this list is still current. Prepare lifecycle deployment, Auth hook and retention
   schedules. Do not reuse a DEV enabled flag to turn on production.
5. **Operational checks and recovery.** Verify the actual provider/log/backup
   arrangements and current encrypted backup. All nine migrations and agreement
   history passed the isolated local ordered-row/API restore rehearsal. A hosted
   SQL-import/cutover plan remains separate; resolve seeded singleton configuration
   rows, preserve the latest deletion ledger and original agreement times, and
   prevent mail/public access during any restore.
6. **Deliberate launch approval and controlled smoke test.** Present the final
   concrete change set to Ryan before any production change. With approval, keep
   registration closed while installing prerequisites. Verify production sender,
   subjects/bodies, expiry, exact URLs, password rules, confirmation, anonymous
   signup disabled, Auth hook, lifecycle/retention and public-read protections.
   Use a controlled real-inbox test with Ryan completing password entry, email
   confirmation and any actual Terms agreement. Confirm viewer-only access,
   sign-out/session expiry, recovery, personal export and confirmed deletion.
   Public signup itself requires an explicitly approved initial registration
   window; other people can register during that window. Use the detailed
   readiness sequence rather than describing that smoke test as private.
   No test account should
   inherit Ryan's existing stories/games or contributor/admin access.

## Verification of this preparation batch

Automated checks cover fixed production destination, fragment-only token links,
absence of DEV/local labels or metadata redirects, accessible HTML structure and
inert sandboxed previews. The local config continues to bind the local templates;
the new production files are not referenced by it. Actual production delivery and
other email clients remain untested. No legal compliance certification is implied.

Reference: [Supabase email templates and supported variables](https://supabase.com/docs/guides/auth/auth-email-templates).

## Disabled-by-default adapter verification

79 automated tests passed, including the fixed production configuration, privileged
key rejection, HTML/404/network response handling, exact callbacks, independent
lifecycle switch/CORS and identity verification, plus refusal to submit signup
without published agreement controls. Real DEV account/security API tests passed
with disposable fixtures cleaned up. 724 references and 113 JavaScript syntax
checks passed. Preview and production-candidate builds each contain 189 public
files and no runtime config with their normal settings. An explicit production
opt-in was also tested and refused the current unpublished policy registry. No
production key was read and no hosted function/settings were changed in this batch.

For the later approved release, the production build requires exact string true
for FAS_PRODUCTION_ACCOUNTS_ENABLED and FAS_PRODUCTION_LIFECYCLE_ENABLED, plus
FAS_PRODUCTION_PUBLIC_KEY containing a nonprivileged public key. The public value
is emitted only to the generated runtime config; server credentials never belong
in these inputs. The backend function's lifecycle flag is a separate deployment
setting and must be verified independently of build variables. An active published
registry entry, exact frozen snapshot paths and matching file hashes are mandatory.
Do not set any of these production flags during preparation.

Cloudflare branch builds identified by WORKERS_CI_BRANCH other than main, and
GitHub pull-request builds, omit production runtime configuration even when
inheriting enabled build variables. Preview builds without branch metadata reject
an explicit production opt-in. The runtime config has Cache-Control: no-store;
readers also request it without caching. Never deploy after a failed build or reuse
a prior build artifact as evidence of readiness. Public keys identify the app;
server-side RLS and verified user sessions still enforce permissions. Publishable
keys are opaque, so their actual project association must also be checked at rollout.

References: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Cloudflare build branch variables](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#environment-variables).
