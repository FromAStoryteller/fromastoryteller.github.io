# Remembered sign-in update

Status: prepared and locally tested; not yet deployed. The live task previously
passed its tab-only session acceptance tests. Ryan then requested persistence
across new tabs and browser visits.

The sign-in checkbox **Keep me signed in on this device** defaults to checked.
It uses localStorage with a project-specific key and the SDK's normal refresh
lock and BroadcastChannel. Opening a new tab or browser visit reads the same
session and verifies it with Auth. Unchecking the option uses sessionStorage
with a separate tab key/channel. Existing tab sessions are migrated as tab-only;
they are never silently copied to persistent storage. Sign out and sign in with
the checkbox selected to opt an existing session into remembered storage.

Passwords are never stored. The SDK rotates session credentials, verifies live
identity and handles server expiry/revocation as before. Browser removal of site
data, sign-out or server revocation can require another sign-in. No forced
inactivity or maximum session timeout was added. Optional appearance/game storage
consent remains independent of the sign-in persistence choice. A shared-device
user can select tab-only and should sign out explicitly; browser tab restoration
may retain sessionStorage.

Sign-out revokes the current session and clears its cache across remembered
tabs, without revoking unrelated sessions on other devices. Settings and agreement
history hide private details on SDK sign-out events. A storage-event fallback
handles browsers without BroadcastChannel. Tab-only sessions remain independent.
Blocked localStorage falls back to sessionStorage, then memory. Only owned Auth
keys are removed; unrelated settings and game records are preserved.

The new policy candidate account-sessions-2026-10-16-v2 explains the storage
change. The v1 documents and hashes are untouched; existing agreement records are
not rewritten. Terms substance is unchanged; its version/header and Privacy links
are paired with the new notice. The tested transition SQL is preparation only:
it locks the requirement, verifies the exact published predecessor and immutable
hashes, permits an idempotent retry, and rejects null/unexpected predecessors or
hash conflicts. It creates no user agreements.

Release sequence after review: briefly close signup; publish the matched frontend,
current notices and frozen v2 documents with the production runtime selecting v2;
verify exact public policy hashes; apply the prepared v1-to-v2 transition; check
the runtime/server match and reopen signup. Keep signup closed if verification
fails. Do not remove old releases or agreements to resolve a mismatch. Existing
accounts accept the new version themselves where required.

Validation: focused unit tests cover remembered/new-tab/restart adapters,
tab-only isolation, legacy migration, blocked storage, shared cache cleanup,
private-UI logout events and existing expiry/error handling. The local-only
integration uses a disposable viewer and real Auth to verify restoration through
independent adapters, shared logout, tab-only isolation and cleanup. It captures
local CLI keys in process memory and refuses other API targets.

Commands: `npm test`, `npm run test:sessions:remembered:local`,
`npm run validate:references`, and both Cloudflare builds.

The adapter restart test is not a claim that a real browser process was closed;
the final live browser/tab/reopen check follows release with Ryan entering his
credentials himself. Browser storage policy/private browsing can still prevent
persistence.

References: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions),
[Auth sign-out](https://supabase.com/docs/reference/javascript/auth-signout).
