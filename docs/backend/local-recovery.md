# Local password recovery

Recovery is connected only at http://127.0.0.1:55400 to the isolated FAS stack.
Hosted account pages remain inactive. No external SMTP or production setting changed.

1. Enter a disposable account email at `/account/recover/`.
2. Mailpit at http://127.0.0.1:55324 captures its recovery email. Known and missing
   addresses receive the same page guidance; there is no account lookup.
3. Open the email link and select Continue. Supabase verifies the single-use recovery
   token before the form is enabled. Simply being signed in does not unlock it.
4. Choose a different password meeting the existing 12-byte/category policy and
   confirm it. Success requires a successful server response.
5. Sign in with the new password. A successful reset attempts global sign-out and
   reports any failure to confirm sign-out accurately.

The token is in the URL fragment, which is not sent as part of the page HTTP request.
The page immediately removes fragment/query credentials before making network calls,
sets no-referrer, never follows a user-controlled redirect, and uses a separate SDK
client whose recovery credentials are held only in memory. Reloading loses this
recovery context; request a fresh email if the link has already been consumed.
No password/session is logged or written to a fixture file.

The email is not consumed on page GET, reducing email-scanner interference. The
client refuses other token types, duplicate hashes, forged success parameters and
ordinary cached sessions. Supabase remains the authority for password changes.
Existing access JWTs may remain valid until expiry despite refresh-session revocation;
do not describe global sign-out as immediate access-token revocation.

Verification: four controller tests, actual local API/mail tests for known/missing
addresses, throttling, expired and single-use links, old/new passwords, revoked old
refresh sessions and unchanged viewer privileges. Disposable accounts/emails are
cleaned up. Browser checks cover request, inbox, callback and unlocked form. Final
password changes were tested through the API on disposable fixtures.

Run `npm run test:recovery:local` with the same process-only local credentials and
`FAS_TEST_CONFIRM=LOCAL-FAS-ONLY` used by the other local Auth scripts. It only targets
the fixed loopback FAS API and inbox. Never use hosted keys with this script.

References: [request recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail),
[update password](https://supabase.com/docs/reference/javascript/auth-updateuser),
[sessions and JWT expiry](https://supabase.com/docs/guides/auth/sessions).
