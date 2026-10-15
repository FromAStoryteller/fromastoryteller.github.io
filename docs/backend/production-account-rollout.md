# Production account rollout preparation — 16 October 2026

Status: prepared work only; not a production rollout. Ryan approved the production
verification/recovery email wording in the local viewer on 16 October. No message
was sent, production template installed, credential changed or signup enabled.

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

1. **Production adapter.** `account/auth-settings.mjs` currently permits only the
   two fixed loopback origins, and `loadLocalAuthConfig` only obtains configuration
   from the local preview middleware. No production frontend connection exists.
   Add an explicit opt-in for the exact live origin/backend, accepting only a
   nonprivileged public key. Keep absent/malformed configuration closed, reject
   preview/foreign origins and privileged keys, and preserve existing DEV isolation.
   Update account-page test labels only in that verified production mode.
2. **Lifecycle adapter.** Both `account/lifecycle-client.mjs` and
   `supabase/functions/fas-account-lifecycle/environment.mjs` currently refuse
   production. Implement and test a separate explicit production switch and exact
   CORS origin. Personal/content export and deletion must work before opening
   registration; do not remove the allowlist as a shortcut.
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
   Open registration only after the approved checks pass. No test account should
   inherit Ryan's existing stories/games or contributor/admin access.

## Verification of this preparation batch

Automated checks cover fixed production destination, fragment-only token links,
absence of DEV/local labels or metadata redirects, accessible HTML structure and
inert sandboxed previews. The local config continues to bind the local templates;
the new production files are not referenced by it. Actual production delivery and
other email clients remain untested. No legal compliance certification is implied.

Reference: [Supabase email templates and supported variables](https://supabase.com/docs/guides/auth/auth-email-templates).
