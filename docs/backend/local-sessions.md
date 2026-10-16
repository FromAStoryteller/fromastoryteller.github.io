# Local session persistence and expiry

Local FAS account pages now share one Supabase client per page. The SDK persists
its Auth session in tab-scoped `sessionStorage`, so navigation and reloads retain
the session. Passwords are not stored. The existing loopback-only configuration
guards still keep hosted authentication disabled.

This is a local testing choice, not the final production remember-me policy.
Independent tabs use different SDK event-channel keys so a different tab's
sign-out event cannot clear this tab's credentials. The temporary tab ID stays
stable across navigation; a duplicated/restored tab can inherit its session.
Tab storage normally ends with the tab, but browser tab/session restoration can
preserve it. Sign out when finished. The SDK handles token rotation/refresh; no
custom JWT authentication or role assignment is introduced.

## Restoration and feedback

The sign-in page first shows Checking your session. It obtains the SDK session,
refreshes it with Auth to check server expiry/revocation, and calls `getUser()` to
validate identity before displaying the signed-in view. Cached user details and
editable metadata never decide authorization. RLS remains authoritative.

SDK sign-out events from failed refreshes clear the signed-in view and announce
that the session ended. A previously stored session rejected during restoration
likewise shows Your session has ended. Please sign in again. Owned Auth cache
keys and the current tab's pending signup email are cleared.

Connection/server failures retain potentially valid stored credentials and show
a retry button. Rate limits explain that the person should wait briefly. User
identity stays hidden while restoration is unverified, and normal inputs remain
disabled during the check or a connection failure. The page checks again when
restored from browser history cache, and after returning to the visible tab
following at least a minute away.

Successful explicit sign-out revokes the current refresh session and clears its
tab cache. Reloading then stays signed out. Other device sessions are unaffected.
Existing access JWTs can remain valid until expiry, as documented by Supabase;
this client feedback does not change backend JWT revocation semantics.

Storage that is blocked initially or fails later falls back to page memory. The
preview notice explains the initial fallback. No unrelated theme/site keys are
deleted. Session tokens are credentials, so the SDK-managed tab storage needs the
same XSS protection and deployment review as any browser Auth integration before
production enablement. Privileged/service keys never enter the browser.

## Validation

Eight contract tests cover storage persistence/scoped cleanup, independent-tab
event keys and migration of the earlier local cache, blocked storage,
server identity validation rather than cached identity, rejected/expired sessions,
connection/rate-limit behavior, guest versus ended-session feedback, and user
rejection after refresh.

The direct local session test uses in-memory backing for the same storage adapter
and real Auth requests. It verifies restoration in a new client, refresh after a
simulated expired cache, actual server session expiry (`auth.sessions.not_after`
on only its temporary fixture), cache clearing, sign-out and fresh-client guest
state. No server timeouts or hosted policies were changed.

The browser signed in a disposable viewer, visited Home, returned and reloaded
without signing in again. Expiring only its local server session then returning
produced the expiry message and cleared fields/cache. Signing in again, signing
out and reloading left it signed out. A two-tab browser check verified that signing
out in the first independent tab left the second signed in, including after its
reload. Both API/browser fixture accounts were removed.

Run `npm run test:sessions:local` with the local-only process environment from
[local sign-in](local-sign-in.md), substituting this test command in the `try`
block. It targets only 127.0.0.1:55321 and the fixed local FAS database container.
Never paste or print the CLI keys.

Recovery, account lifecycle, site-wide account navigation, production persistence
and any inactivity/absolute timeout policy remain later decisions. This batch
handles expiry imposed by Auth without selecting a new timeout duration.

Official references: [sessions](https://supabase.com/docs/guides/auth/sessions),
[getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[Auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange),
[sign-out](https://supabase.com/docs/reference/javascript/auth-signout).
