# Homepage following membership - 30 October 2026

The homepage now calls `fas_my_following_ids()` once instead of paging through
`fas_my_following()` and discarding the returned names, bios and images.
The Following page retains its existing profile-card and pagination contract.

The new public wrapper is a security invoker. Its private implementation obtains
the caller with `private.require_operator_session()`, enforcing a verified active
account and a current session belonging to that account. There is no caller ID
parameter. Anonymous and service-role execution are revoked; authenticated users
can read only their own membership.

Results contain sorted public UUID strings only, with no profile objects,
timestamps, account IDs, follower counts or cursor. Personal target eligibility
uses the existing public publishing-author helper. FAS membership follows the
same brand-availability rule as the existing profile-list endpoint. Current
account closure, target role removal and deletion therefore take effect on the
next read. Existing private table permissions and account export are unchanged.

The existing 5,000-follow limit bounds the endpoint and client response. Oversized
data fails rather than silently truncating the ordering set. Client reads are
discarded when the account view ends. The IDs are not persisted or placed into
shared delivery caches. Follow/unfollow, cross-tab change, focus/reconnect and
Back restoration retain their fresh-read lifecycle.

Validation includes exact membership parity with five legacy profile pages for
100 followed people plus FAS, another account's isolation, forged/expired session
denials, active-account checks, target eligibility changes and deletion cleanup.
Client tests cover 100 and 5,000 IDs in one request, malformed/oversized responses
and late results after session end. The real-module signed-in browser fixture now
uses 100 follows and asserts one IDs request and zero profile-list requests at
desktop/phone widths. It is included in the browser CI workflow before Vite starts.

Deploy the additive endpoint to DEV and production before publishing the client.
For rollback, restore the earlier homepage/service code; leaving the unused,
private endpoint installed is safe. Public Following-page profiles, follow writes
and contributor follower counts are not changed. No policy wording changes are
needed: processing purpose and existing private following choices are unchanged.
