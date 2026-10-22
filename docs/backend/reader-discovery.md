# Reader discovery and automatic featured work

Featured selection is derived from public publications; no contributor or administrator needs to set a featured flag.

| Surface | Selection |
| --- | --- |
| Homepage | Latest published item across all types for each public contributor identity |
| Category page | Latest item in that category for each public contributor identity |
| Storyteller profile | Latest item of each type by that storyteller |

`systems/content/featured-selection.mjs` supplies the shared rules. Selection uses publication date/time, ignores manual featured/pinned flags and modification time, excludes drafts and future publications, and uses stable IDs to break identical publication timestamps. Both static index generation and browser hydration use these rules. Live public content is fetched on page visits; newly published uploads become eligible automatically. A profile's featured work comes from the complete public catalogue, rather than its paginated work list.

Story discovery offers genre, reading length and ordering controls. Filter values are included in the URL so reload and Back retain the selection. Genre labels are shared with contributor metadata. Cards link to authors separately from the content link.

Read/Played/Used badges reflect the existing private `experienced` action. They contain text as well as a check icon; opening a story alone does not mark it as read. Existing authenticated action reads, session clearing and cross-tab refresh behaviour remain in use. No new account data or database tables are introduced.

Following reads every cursor page of the reader's own follow list, then intersects those public contributor IDs with the public catalogue. Work is displayed newest first, with separate pagination for work and storyteller cards. Account changes clear the private list and feed. Errors retain a retry action and do not claim an empty feed.

Story endings include an author panel with a public profile link and the same Follow/Following/Unfollow controls used on profiles. Owners see only Edit profile and Storyteller Studio above their public profile. Full account navigation stays in the account menu and sidebar.

The compact desktop navigation shows labels on hover and keyboard focus. Escape dismisses a label. Phone navigation continues to use the expanded text menu.

Validation: `tests/reader-discovery.test.mjs` covers featured fairness, publication ordering, draft/future exclusions, filter boundaries, follow pagination, session interruption and card link safety. `scripts/test-reader-discovery-browser.mjs` exercises real modules with fictional account services, including mobile widths, badge updates, the author panel, private feed clearing and delayed search loading.
