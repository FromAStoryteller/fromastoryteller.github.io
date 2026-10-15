# Viewer accounts: small review batches

Ryan's working preference: create skeletons using the existing HTML structure,
shared site shell and theme tokens, show each batch in the browser, then refine
the personal design together. Content artwork uses 16:9. Sign-in and sign-up use
centred forms without decorative artwork or introductory side panels for now.
Keep Play My Path separate.

1. Sign-in page skeleton: local design preview, disabled controls, no Auth changes.
2. Review the visual direction together; extend it to sign-up and recovery skeletons.
3. Review Privacy and Terms against actual features, operator details, audience and
   jurisdiction. Prepare accurate drafts for Ryan to review; resolve legal questions
   before opening registration. Do not describe draft policies as legal approval.
4. Implement verification, sign-in/out, session refresh/expiry and recovery in FAS
   development, with success/error states and browser/email tests.
5. Agree account settings/deletion behavior and implement the account lifecycle.
6. Rename/rework the site About navigation and its icon separately from Ryan's
   personal profile, retaining the existing route unless a redirect is needed.
7. Once Ryan chooses the final account and username, plan explicit attribution of
   existing stories/games to its stable account UUID. Preserve content, URLs and
   backups; do not auto-import or assign content to temporary accounts. A username
   is a display/search identifier, not the immutable ownership key.
8. Add profile search only for intentionally public profile information. Protect
   emails, account details, private profiles and drafts; review search indexing rules.
9. Perform final end-to-end checks, legal review and deliberate production signup
   enablement. Signup alone must never grant contributor privileges.

The sign-in, sign-up and recovery pages use matching centred forms. Sign-in now
works only through the deliberately enabled local FAS connection; see
[local sign-in](local-sign-in.md). Signup and verification also work only locally;
see [local signup](local-sign-up.md). Recovery now works locally; see [local recovery](local-recovery.md). Hosted public
registration and live-site changes are not enabled.
The recovery-request form sends local test emails and uses conditional guidance without identifying whether an account exists. The new-password landing screen shares live password/confirmation checks with sign-up and unlocks only after a server-verified recovery link. Hosted FAS password
rules were verified in both projects; see [password preview](password-preview.md).
Hosted signup permits only sample password entry; hosted password recovery stays inactive.
The local signup flow sends confirmation emails to the local test inbox, with
resend throttling and verified success/invalid-link states. Verification requires
a server-validated token and an explicit confirmation action; success is never
inferred from URL parameters. Tab-scoped sessions now survive navigation/reloads
with server verification, expiry feedback and retryable connection states; see
[local sessions](local-sessions.md). Profile editing and account-data export also work locally; see [account settings](local-account-settings.md). Complete owned Community story/image exports and confirmed deletion now work locally; see [local lifecycle](local-account-lifecycle.md). Future game types and hosted rollout remain separate.

This sequence records the requested work; the account skeleton batches are in progress.
Later batches may change after Ryan reviews each skeleton.

The recovery form and recovery-email confirmation skeleton use the same conditional
message for existing and missing accounts. They do not perform account lookups.
The confirmation route is a design preview, not evidence of an email being sent.
During Auth integration, use a consistent recovery response for known/unknown
emails, and separately handle network/rate-limit errors without exposing account
existence. Verify direct API responses as well as page text before launch.
Reference: [OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

Current additional work: [storage choices](storage-choices.md), [lifecycle decisions](account-lifecycle-decisions.md), and [future FAS game data](future-game-account-data.md). Account Privacy/Terms drafts are available at `/account/privacy-preview/` and `/account/terms-preview/`. They are marked as drafts and are not the live account policy.

## Latest local verification

The user completed the final browser deletion confirmation. The local Auth identity, owned story rows and Storage originals were verified absent; the deleted login was denied. Disposable fixture records were removed. Personal account-data downloads work for viewers and contributors, with a separate server-enforced contributor content download. All remain local-only.

The About navigation now says About the site with a circle-info icon; its existing route, content and theme are preserved. The page heading identifies From A Storyteller. No personal profile or content attribution was invented.
