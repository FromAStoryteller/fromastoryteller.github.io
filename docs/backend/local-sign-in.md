# First local sign-in batch

The sign-in page now connects to local FAS Supabase only when started deliberately
with `npm run dev:accounts:local`. Normal previews and hosted builds retain disabled
sign-in controls. Local signup and verification now work in a separate batch; see [local signup](local-sign-up.md). Recovery remains a design skeleton.

## What works

- Email/password sign-in, pending feedback, a signed-in identity and sign-out.
- Wrong-password, unknown-account and unverified-email responses use the same
  message. Rate-limit and connection failures have separate safe messages.
- Passwords are cleared and hidden after submission. They are not logged or saved
  by application code, and fields have no names that could enter a native GET URL.
- Supabase SDK 2.117.3 is pinned in the lockfile and bundled locally with dependency
  licenses. Run `npm run build:auth-client` when deliberately updating it.
- Refresh uses the SDK while an account page is open. Sessions now survive page
  changes and reloads in tab-scoped storage and are server-verified before the
  signed-in view is restored; see [local sessions](local-sessions.md). Site-wide
  account controls and the production persistence policy remain later work.

Sign-out uses `scope: 'local'`, revoking this session's refresh token without signing
out other devices. Existing access JWTs can remain valid until their expiry, per
Supabase's documented behavior. RLS continues to decide permissions server-side;
the page neither assigns roles nor treats user-editable metadata as authorization.

## Local connection boundary

The starter captures local CLI status without printing or saving its keys. It
requires project ID `fas-community-v1` and API URL `http://127.0.0.1:55321`, passes
only the local anon key into Vite's process, and binds the preview to 127.0.0.1:55400.
The starter drops the captured status object, including its privileged key.

Vite's configuration endpoint requires the exact preview host and rejects cross-site
requests. It returns only the local URL and local anon client key with `no-store`.
The browser checks its exact local origin, expected API URL and anon/demo key
claims before enabling sign-in. There is no hosted fallback or production config.
This guard is a development boundary, not authentication or a substitute for RLS.

The SDK does not consume tokens from the page URL. Redirect query parameters are
not used, and sign-in does not enable password resetting or email verification.

## Validation

Six new contract tests cover target/key restrictions, configuration host checks,
credential handling, safe messages, duplicate-request prevention and failed sign-out.
The initial 36-test sign-in batch passed; subsequent signup and session batches
expanded coverage. See the corresponding documents for their validation.
Browser tests covered wrong-password feedback, show/hide, successful sign-in,
sign-out, cleared fields, focus return and a narrow layout.

The direct local API test uses a temporary account and removes it in `finally`.
It verified successful sign-in and refresh, refresh-token revocation after sign-out,
equal errors for missing/wrong credentials, and denial of publishing/self-promotion
even with misleading editable admin metadata. The separate browser fixture was
also removed after the browser check. No live accounts or Auth settings changed.

For a future local rerun, start Docker and the isolated FAS stack, then in PowerShell:

```powershell
$fasLocalStatus = npx.cmd --yes supabase@2.120.0 status -o json | ConvertFrom-Json
if ($fasLocalStatus.API_URL -ne 'http://127.0.0.1:55321') { throw 'Expected local FAS' }
$env:FAS_TEST_ANON_KEY = $fasLocalStatus.ANON_KEY
$env:FAS_TEST_SERVICE_KEY = $fasLocalStatus.SERVICE_ROLE_KEY
$env:FAS_TEST_CONFIRM = 'LOCAL-FAS-ONLY'
$fasLocalStatus = $null
try { npm.cmd run test:auth:local }
finally {
  Remove-Item Env:FAS_TEST_ANON_KEY,Env:FAS_TEST_SERVICE_KEY,Env:FAS_TEST_CONFIRM -ErrorAction SilentlyContinue
}
```

These test keys are process variables, never browser code or committed files.
The local configuration now matches the verified hosted password rules and
requires email confirmation. The signup email flow is local only; do not push
local Auth configuration to hosted projects. Privacy/Terms review and
deliberate production registration enablement remain launch requirements.

Official references: [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
[client initialization](https://supabase.com/docs/reference/javascript/initializing),
[sign-out behavior](https://supabase.com/docs/reference/javascript/auth-signout).
The October 2026 changelog was checked: the upcoming hosted TLS cipher removal
does not require a change to this local browser implementation.
