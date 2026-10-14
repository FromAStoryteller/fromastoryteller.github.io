# Password guidance and preview checks

Verified in both FAS hosted Email-provider panels on 15 October 2026:
minimum length 12; lowercase, uppercase, digits and symbols required.
No hosted Auth setting was changed. Local config still has foundation defaults
(6, no required categories); align that deliberately before real local account-flow tests.

Sign-up and new-password previews share `account/password-policy.mjs` and the
browser checklist in `account/password-checks.js`. Guidance shows all five rules,
live Met/Not met text and a confirmation-match check. Accessible status text reports
the requirement count without echoing password contents.

The matcher follows Supabase Auth's UTF-8 byte-length measurement and required
ASCII character sets. Emoji/space do not replace a required symbol, and passwords
are not trimmed. Server-side Auth remains authoritative when integration is added.
References: [password guidance](https://supabase.com/docs/guides/auth/password-security),
[Auth strength checker](https://github.com/supabase/auth/blob/master/internal/api/password.go).

Only the two password fields are enabled to try synthetic sample input. Submit
buttons remain disabled; preview form submission is prevented. Password inputs
have no name attributes, so the HTML fallback cannot send them in a query string.
The code performs no network request, logging, storage or Auth call. Display-name
and email fields remain disabled. No account is created or password changed.

Real reset use will require a verified recovery session and clear missing/expired
link handling; visiting the preview URL is not authorization to change a password.
Leaked-password protection remains disabled in the hosted projects; this browser
checklist does not perform a leaked-password check or claim that a password is safe.
