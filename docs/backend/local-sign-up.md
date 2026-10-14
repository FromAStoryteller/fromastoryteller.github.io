# Local signup and email verification

This batch adds working signup, check-inbox/resend and email confirmation to the
explicit local account preview. Hosted registration remains closed. Recovery,
password changing, persistent sessions and account lifecycle are later batches.

## What changed

- The local Auth configuration now matches the hosted password policy: minimum
  12 UTF-8 bytes, lowercase, uppercase, digits and symbols. Email confirmation is
  required before sign-in, OTP length is eight, and secure password change is on.
- Local site URL/redirects point to the isolated preview on port 55400. Signup
  emails use the new local-only confirmation template. Link expiry remains one hour.
- Email requests have a 60-second server interval and a matching resend countdown.
  The local hourly email allowance is 30 for disposable test flows; no hosted limit
  was changed and this is not a production rate-limit recommendation.
- The starter enables signup only when its local configuration matches the required
  URL, password rules and confirmation setting. The signup page also checks the
  running Auth server requires confirmation before enabling account creation.
- Signup submits only email, the exact password, and cosmetic `display_name`
  metadata. It neither assigns roles nor accepts contributor/admin choices. Display
  name is retained in Auth metadata; public profile editing/initialization remains
  a later batch (the existing profile trigger still uses its default display name).
- Missing/registered email cases get conditional inbox guidance. Network and rate
  failures have useful messages. Resend likewise avoids account-existence feedback.

The local stack was stopped and restarted without deleting its data volumes.
No hosted Auth configuration, SMTP provider, production site, schema or Play My Path
changes were made. Emails are captured by local Mailpit at 127.0.0.1:55324, not
sent to real recipients. Hosted SMTP/deliverability and the final email design
will be handled separately before launch.

## Link and browser handling

The local email links to `/account/verify-email/` with a Supabase token hash and
fixed type `email`. The page removes query parameters and fragments from the
address using `replaceState` before network requests, sets `no-referrer`, and keeps
the token only in page memory. No token or password is logged or saved by application
code. As with any query-based confirmation link, hosting/request logs require
review before a hosted implementation is enabled.

Opening the page does not consume the token. The person must select **Confirm
email**, which calls Auth's verification API. This prevents an ordinary link
prefetch from consuming it. Success requires the server's confirmed-email response;
URL claims such as `verified=true`, recovery/invite token types, duplicate token
parameters and arbitrary redirect destinations cannot produce success.

Expired/used/invalid links show a clear error and a route to request another email.
Connection failures allow retry. Success leads to sign-in. Sessions are still in
memory for this first integration; sessions across pages are a separate batch.

To prefill the resend form, the local preview temporarily keeps only the entered
email and request time in tab-scoped `sessionStorage`. It is ignored after an hour
and cleared on successful verification in that tab. Storage failure leaves manual
email entry available. No password/token is put in that storage.

## Validation and rerun

Seven new contract tests cover required configuration, client password validation,
minimal metadata, privacy messages, unexpected auto-confirmation, resend errors,
URL scrubbing/token types, explicit verification and temporary-email storage.

`npm run test:signup:local` uses only the fixed FAS loopback API/inbox and requires
the same environment keys and `LOCAL-FAS-ONLY` acknowledgement as the local
sign-in test. See [local sign-in](local-sign-in.md) for that environment setup;
substitute this script in its `try` block. Do not print or paste CLI keys.

The direct test verified server password enforcement, no session before email
confirmation, blocked unverified sign-in, actual captured mail, immediate resend
throttling, replacement/single-use links, verified sign-in and viewer permissions
despite misleading editable admin metadata. It simulated elapsed resend/expiry
times only on its own temporary local accounts. Accounts and their mail were removed.

Browser testing covered signup → check inbox/countdown → actual local email →
explicit confirmation → success → password sign-in → sign-out, and reusing a link
produced the invalid-link state. Browser accounts/mail were also removed. Full
repository tests, references, generated indexes and preview build were checked.

Privacy/Terms review and deliberate production enablement remain required before
real registration. This draft batch does not claim that the full account task is done.

Sources: [Supabase signup](https://supabase.com/docs/reference/javascript/auth-signup),
[verification API](https://supabase.com/docs/reference/javascript/auth-verifyotp),
[email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[Mailpit API](https://mailpit.axllent.org/docs/api-v1/).
