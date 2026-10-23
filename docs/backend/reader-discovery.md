# Reader discovery and automatic featured work

Featured selection is derived from public publications; no contributor or administrator needs to set a featured flag.

| Surface | Selection |
| --- | --- |
| Homepage | Latest published item across all types for each public contributor identity |
| Category page | Latest item in that category for each public contributor identity |
| Storyteller profile | Latest item of each type by that storyteller |

`systems/content/featured-selection.mjs` supplies the shared rules. Selection uses publication date/time, ignores manual featured/pinned flags and modification time, excludes drafts and future publications, and uses stable IDs to break identical publication timestamps. Both static index generation and browser hydration use these rules. Live public content is fetched on page visits; newly published uploads become eligible automatically. A profile's featured work comes from the complete public catalogue, rather than its paginated work list.

Shared discovery is available on Home, Stories, Games, Tools, Blog, Videos, Gallery and Your history. Home offers content type; selecting a type reveals its relevant controls. Stories/blogs offer reading length, games offer player mode and account saves, tools offer purpose, and populated metadata supplies formats, genres and topics. Every surface offers publication and title sorting. Filter values are included in the URL so reload and Back retain the selection. Genre labels are shared with contributor metadata. Cards link to authors separately from the content link.

Read/Played/Used badges reflect the existing private `experienced` action. They contain text as well as a check icon; opening a story alone does not mark it as read. Existing authenticated action reads, session clearing and cross-tab refresh behaviour remain in use. No new account data or database tables are introduced.

Following reads every cursor page of the reader's own follow list, then intersects those public contributor IDs with the public catalogue. Work is displayed newest first, with separate pagination for work and storyteller cards. Account changes clear the private list and feed. Errors retain a retry action and do not claim an empty feed.

Editorial, game, tool and video endings include an author panel with a public profile link and the same Follow/Following/Unfollow controls used on profiles. Follow state is conveyed by the shared Follow / Following dropdown itself, without a separate relationship description. The public profile owner controls are grouped under Manage profile. Account pages group their destinations and sign-out under Your account, with the current location shown alongside. Shared secondary actions use the same button styling even on public pages that do not load account.css; contextual author links remain inline.

The compact desktop navigation shows labels on hover and keyboard focus. Escape dismisses a label. Phone navigation continues to use the expanded text menu.

Validation: `tests/reader-discovery.test.mjs` covers featured fairness, publication ordering, draft/future exclusions, filter boundaries, follow pagination, session interruption and card link safety. `scripts/test-reader-discovery-browser.mjs` exercises real modules with fictional account services, including mobile widths, badge updates, the author panel, private feed clearing and delayed search loading.

Home prioritizes followed contributors in both its featured carousel and discovery grid. The selected sort applies within the followed and remaining groups. Selection fairness is unchanged. Following is loaded with the existing authenticated cursor API, refreshed on focus/reconnect/cross-tab changes, and cleared immediately on account end.

Your history at `/account/history/` uses the existing `fas_my_viewer_actions` RPC in batches of at most 100 public content URLs. This resolves file and Studio identities without exposing private identifiers or using export APIs. Only pieces marked experienced are included, in publication order, with shared filters. Account changes clear the results; read-status changes refresh them. It is not an automatic browsing log and does not display unavailable publications. No database migration is required.

Additional validation: `tests/content-discovery.test.mjs` and `scripts/test-reader-controls-browser.mjs` exercise mixed-content filters, private history batching, followed-first ordering, actual category entry points, compact navigation, live follow changes, session clearing and 1440/390/320px layouts using fictional account data.
