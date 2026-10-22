# Public contributor discovery

`/storytellers/` is an anonymous, alphabetical directory. Its search matches
public display names, welcome lines and biographies. `/storytellers/?author=UUID`
remains the permanent public profile address; public pages load without an Auth
session and show only the existing published-work projection. Optional owner
controls load independently and destinations recheck access.

The additive `public_storyteller_directory` migration adds the paginated
`fas_public_profile_catalog` RPC. It returns at most 24 public profiles per page,
using the existing active-contributor gate and a name/public-ID cursor. It also
includes the existing public FAS organisation profile. Viewer accounts, revoked
contributors, accounts being removed, emails, account IDs and draft work are
excluded. The RPC is read-only; existing profile editing and visibility rules
are unchanged. Search input is bounded and matched literally, not as SQL patterns.

Site search and header suggestions include links to public profiles. Directory
and search requests discard late responses after a query changes. Profile and
directory pagination provide retry controls. Browser Back restores usable pages.

The shared header account renderer adds Storytellers to sidebar pages and uses
its existing account state to show a separate Your library section containing
Favourites and Saved for later. No additional Auth request or private list data
is used to draw these links. Sign-out hides the section; list destinations still
require their own verified session. The runtime upgrade also covers older shared
navigation without modifying immutable policy snapshots.

Verification covers anonymous directory pagination and privacy in PostgreSQL and
hosted DEV rollback fixtures, public search/profile navigation, published-work
pagination, late-query responses, retry, account transitions, browser restore and
desktop/mobile light/dark layouts. Production verification uses read-only calls.
