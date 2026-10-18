# Transactional email setup

Status on 18 October 2026: configured and verified in production. DEV and production have separate restricted sending credentials and enabled signed delivery webhooks. Controlled production invitation, password recovery and email verification messages reached Inbox, and their live links completed successfully. Invitation acceptance and signed delivery events are recorded; password recovery changed the password, allowed subsequent sign-in and rejected reuse. The verification test account is confirmed and has no contributor or administrator role. The public sending-subdomain DMARC record is verified.

## Verified sender

- Domain: `auth.fromastoryteller.com` (Resend, sending verified).
- From: `From A Storyteller <no-reply@auth.fromastoryteller.com>`.
- SPF and DKIM are verified. Open and click tracking are disabled.
- Keep the existing Supabase SMTP credentials and confirmation/recovery templates.
- Verification and recovery links expire after 3,600 seconds. Their exact callbacks are `https://fromastoryteller.com/account/verify-email/` and `https://fromastoryteller.com/account/reset-password/`.
- Confirmation/recovery credentials and contributor invitation tokens use the URL fragment; the page removes the credential from the address bar and requires an explicit action before consuming it.

## 1. Add the missing DMARC record

In the DNS manager that currently holds the domain's existing records, add:

| Type | Host/name | Value | TTL |
| --- | --- | --- | --- |
| TXT | `_dmarc.auth` | `v=DMARC1; p=none;` | Automatic/default |

If that DNS manager requires the full name, use `_dmarc.auth.fromastoryteller.com`. Check whether it appends the root domain automatically. Do not create two DMARC records at the same name. If a record has appeared since the check, review it rather than adding a duplicate. This is a monitoring policy; review alignment and provider reporting before strengthening it. Do not change root MX records or personal mailbox routing.

## 2. Install DEV credentials privately

1. Open [Resend API keys](https://resend.com/api-keys). Create a **sending access** key restricted to the verified `auth.fromastoryteller.com` domain, named `FAS contributor invitations DEV`.
2. Open [Resend webhooks](https://resend.com/webhooks), select the prepared DEV endpoint ending in `oqmmvjjycpyxvxipcyli.supabase.co/functions/v1/fas-email-events`, and reveal its signing secret. Its webhook ID is `07ae81d6-ec79-40ec-91fc-2aba6f91a50c`. It is enabled following the controlled DEV setup; use its existing signing secret when maintaining that environment.
3. Open [DEV Edge Function secrets](https://supabase.com/dashboard/project/oqmmvjjycpyxvxipcyli/functions/secrets) and save:

| Secret name | Value |
| --- | --- |
| `FAS_RESEND_API_KEY` | The DEV sending key from step 1 |
| `FAS_RESEND_WEBHOOK_SECRET` | The DEV webhook's signing secret |
| `FAS_EMAIL_TEST_TO` | One controlled test inbox, in lowercase; additional explicitly approved addresses may be comma separated |

4. Enable that DEV webhook in Resend after saving the secrets. Leave open/click tracking disabled.
5. Open the locally served DEV site at `http://127.0.0.1:55410/account/admin/`, sign in with a DEV admin, and choose **Refresh delivery status** under Invitations. This verifies the admin session and enables the database retry worker. Never put a production token into the DEV site.
6. Send one invitation to the allowlisted test inbox. DEV messages are prefixed `[FAS DEV]` and link to the local DEV site. The recipient must have a verified DEV account with the same email to accept.

Keep keys and signing secrets out of chat, screenshots, source files and terminal history. The dashboard can receive them directly; no local secret file is needed. A different endpoint's webhook secret will fail signature verification.

## 3. Check delivery and link behavior

- The UI first shows **Accepted by email provider**. Refresh after the provider event and confirm **Delivered**. Provider acceptance alone is not delivery.
- Check the inbox/spam folder, sender name, subject, button and plain-text alternative.
- Accept while signed in to the matching verified account. It grants contributor access only. Reusing the accepted link must fail.
- For a second controlled invitation, choose resend after one minute. The previous link must fail, and the new link must work until the original expiry. Resending does not extend expiry.
- Revoke an unused invitation. Its link must fail and queued email must cancel.
- Verify confirmation and password recovery from controlled accounts, including opening the correct site, explicit confirmation, successful use, reused/expired links and requesting a replacement link. The password recovery request must remain generic for unknown addresses.
- Do not provoke real bounces, complaints or account lockouts to test failure handling. Automated tests cover temporary/provider failures, bad signatures, stale/duplicate events, rate limits, revoked/expired access and idempotent retries. Live failure-event testing can use Resend's documented test destinations with a disposable fixture once approved.
- Record the completed inbox/link checks without retaining private links, tokens or mailbox content in source control.

## 4. Enable production after the DEV inbox check

Repeat the API key and secret steps with a **separate production sending key** named `FAS contributor invitations production`.

- [Production secrets](https://supabase.com/dashboard/project/vzdicnufhidelaoeqbza/functions/secrets): set `FAS_RESEND_API_KEY` and `FAS_RESEND_WEBHOOK_SECRET`. Production does not use `FAS_EMAIL_TEST_TO`.
- Production webhook: `https://vzdicnufhidelaoeqbza.supabase.co/functions/v1/fas-email-events`, ID `692b25f1-fd96-433c-b81e-1ecb4afeb8da`. It is enabled and its signed delivery event has been verified. For a fresh setup, use its own signing secret before enabling it.
- Open [production admin tools](https://fromastoryteller.com/account/admin/), refresh delivery status, and send one explicitly agreed invitation to a controlled inbox. Confirm **Delivered** and correct production link behavior.
- Both endpoints subscribe only to delivered, delivery_delayed, bounced, complained, failed and suppressed events. No open/click events or tracking pixels are used.

If configuration is removed or incomplete, **Send invitation email** is disabled and **Create a private link instead** continues to work. Missing configuration cannot silently create an invitation email job.

## Runtime and recovery

- Only a current verified admin session can queue invitations. A contributor or anonymous caller cannot queue, inspect private payloads, claim jobs or forge delivery events.
- Automatic retries retain the same immutable template, recipient, invitation token and provider idempotency key. The UI also retains the same request reference after an uncertain response.
- Temporary network errors, HTTP 429 and provider 5xx retry with bounded backoff. Concurrent identical requests retry; conflicting payloads, authorization errors and other permanent provider errors fail.
- Maximum six attempts within one hour; retry delays are bounded to 30–900 seconds. A one-minute cron resumes due work even if the browser closes.
- Admin limits: 20 queued emails per hour, at least one minute between sends for an invitation, maximum three sends per invitation per hour. Bounced, complained and suppressed destinations are blocked from resending.
- Resending rotates the invitation token; acceptance or revocation cancels pending jobs. Expired invitation, removed admin access or expired originating session cancels a claim.
- Raw invitation credentials are held only in the inaccessible private outbox while needed for a retry; they are purged on provider acceptance, cancellation, permanent failure or the one-hour delivery limit. Outbox history lasts 30 days; minimal event metadata lasts seven days.
- Webhook HMAC signatures cover the unmodified body and timestamp. Requests older than five minutes, bad signatures and oversized bodies fail. Durable database recording precedes acknowledgement so the provider can retry safely.
- Delivery events arriving before send acknowledgement are reconciled. Duplicates and older events do not regress confirmed delivery. Provider-level confirmation/recovery events are acknowledged without retaining unknown recipients or message bodies.
- To pause invitations, remove `FAS_RESEND_API_KEY` in that project's Edge Function secrets, then refresh admin delivery status. Manual private links and existing SMTP verification/recovery remain available. Reinstall the same restricted key and refresh to resume; old links are never automatically extended.

## Deployment evidence

Source migration: `20261018033343_transactional_email.sql`, generated with Supabase CLI 2.120.0. Hosted application versions: DEV `20261018041028`; production `20261018041356`. Preserve this mapping when reconciling CLI history; do not rerun the migration because the hosted timestamp differs.

Both projects have `fas-contributor-email` and `fas-email-events` version 1 deployed. The contributor endpoint verifies current Auth identity plus the admin/session RPC, and the event endpoint verifies provider signatures; gateway JWT verification is intentionally replaced by those checks. The database worker uses a short-lived, one-use hashed nonce.

Validation: 171 automated tests, actual Edge image codec checks, reference/content validation, Cloudflare build and worker bundle passed. The additional hosted DEV rollback fixture passed, including wrong-recipient acceptance, one-use/expired links, revocation, session expiry and private payload access. Desktop (1280px) and mobile (390px) browser checks passed for provider-accepted versus delivered labels, failed sends, disabled setup, manual fallback and no horizontal overflow. No real messages were sent by these tests.

Release checks completed on 18 October 2026. No configuration or delivery blockers remain. A disposable verification-test viewer account remains for operator cleanup through Account settings; no content or privileged roles were added to it.

DEV evidence: the initial controlled email reached Spam; after the recipient marked it Not spam, the next message reached Inbox. This is recipient-specific feedback, not proof of general inbox placement. The second message produced a signed delivered event, and explicit invitation acceptance was recorded. Browser checks at 1280px and 390px verify the initially signed-out journey, automatic return after sign-in, explicit acceptance, success copy, removal of the pending credential and refreshed admin summary/row counts. A hosted DEV transaction verifies that a viewer gains contributor access without administrator access; all fixture data is rolled back.


## Production acceptance evidence — 18 October 2026

| Check | Result |
| --- | --- |
| Sending identity | Existing verified auth subdomain, SPF/DKIM verified; open/click tracking disabled |
| Public DNS | Exactly one `_dmarc.auth.fromastoryteller.com` TXT record, `v=DMARC1; p=none;`; authoritative Cloudflare nameservers |
| Invitation | Inbox receipt, correct production origin, explicit acceptance saved, email Delivered; one provider attempt |
| Recovery | Inbox receipt, explicit link confirmation, successful password change, subsequent sign-in and rejected link reuse (operator confirmed) |
| Verification | Inbox receipt and explicit confirmation; confirmed timestamp present in production; zero contributor/admin roles |
| Delivery notifications | Both environments enabled; production signed Delivered event recorded durably |
| Endpoint access | Production rejects unauthenticated sends and unsigned events with HTTP 401 after credential installation |
| Failure/retry checks | Automated network/429/5xx and permanent-provider errors, idempotent retries, invalid/stale signatures, duplicate/out-of-order events, expiry, revocation, session removal and role enforcement pass |
| Browser flow | Signed-out sign-in continuation and explicit acceptance, success copy, pending credential cleanup and matching row/summary refresh pass at 1280px and 390px |

Public read-only rollout checks passed in GitHub Actions job `117594670463`. Live checks were performed by the operator; passwords, API keys and tokenized links are not retained in this record. Inbox placement was verified only for the controlled recipient and is not a guarantee for every mailbox. DMARC remains at the documented monitoring policy; review alignment and reporting before stronger enforcement.
