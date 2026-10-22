# Private storyteller following

Verified active accounts can Follow a public storyteller or the FAS organisation.
Following opens a native disclosure containing the red Unfollow button. Guests
are returned to the exact public profile after signing in. Contributors cannot
follow their own personal profile. The public profile remains readable without
an account and does not expose counts or follower identities.

Following appears alongside Favourites and Saved for later in the signed-in
sidebar, header account menu and account navigation. `/account/following/` is a
private, alphabetically ordered profile grid with keyset pagination and retry.
Unavailable or revoked contributors are omitted. Auth changes clear the private
list and pending results; focus, reconnect and cross-tab changes refresh it.

Storyteller Studio > Insights shows People Following as a current all-time count,
independent of the page/date filter or analytics consent. Contributors see only
their own count; admins also receive People Following FAS. Neither endpoint
accepts an arbitrary account ID or returns follower identities. No notification
or email subscription is created.

`private.storyteller_follows` has RLS with no client grants or policies (intentional
deny-by-default, matching the existing private account tables). Public invoker
RPC wrappers call private functions guarded by the existing verified active
session check. Writes derive the owner from Auth, serialize on the account's
existing closure lock, are idempotent, and cap each private list at 5,000 entries.
Foreign keys remove records when either the follower account or target profile
is deleted. Closing accounts stop contributing to counts immediately.

Own relationships are included in account data v7 and the complete content
snapshot/deletion fingerprint. These exports contain public target IDs and follow
dates, never the identities of people who follow the exporter.

Validation includes real PostgreSQL privacy/session/ownership, pagination,
idempotence, exports, deletion and revoked-role checks; hosted DEV uses a rollback
fixture only. Browser fixtures cover light/dark desktop/mobile layouts, dropdown
keyboard behavior, failed saves, pagination/retry, sign-out and sign-in returns.
