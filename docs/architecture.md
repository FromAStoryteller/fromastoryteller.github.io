# Website architecture

The website repository is the canonical source of shared components, templates, styles and content metadata. Public page URLs remain unchanged.

## Ownership

- assets/: shared fonts, branding, icons and reusable media.
- css/: foundations.css, layout.css, components.css and utilities.css retain their existing responsibilities.
- systems/core/: site-shell.js loads shared components and wires navigation; focus.js provides focus helpers.
- systems/themes/: theme.js applies the saved theme synchronously before styles load and synchronizes browser theme colour after styles are available.
- systems/content/: catalogue rendering, filtering, related content and detail-page behavior. Data stays in content/.
- systems/reading/: story behavior; reading-time.js displays estimates, while reading-time.mjs calculates them for browsers and generation.
- systems/games/: existing shared game modules and their Studio capability manifests. Modules do not import individual games.
- systems/search/: shared header search. The search results page initializer remains in search/search.js.
- components/: authoritative header, sidebar and footer HTML.
- content/: generated content-index.json and story-reading-times.json, plus associated data.
- _templates/: canonical page and metadata templates, Studio contracts/category fragments, and the existing game starter under games/.
- scripts/: indexing and maintenance; tests/: automated checks; docs/: maintenance documentation.

Content-specific JavaScript, CSS, metadata and exclusive assets stay beside their pages in stories/, games/, tools/, blog/ and videos/. Small home/category initializers remain beside their pages. Existing category CSS and games/shared/menu/menu.css retain their paths and selectors; the menu stylesheet is loaded only by game pages. No general CSS redesign accompanies this move.

## Source and generated files

Content pages and per-item meta.json files are the content sources. scripts/generate-site-indexes.mjs generates the catalogue, reading-time data, sitemap, listing cards, reading labels and marked static shell regions. Edit components/ for shell changes, then regenerate; do not maintain separate component copies. This generator writes files even when invoked through npm run validate, so test it in an isolated copy before applying generated output.

Studio resolves the sibling website through the parent workspace.config.json. Its contracts path is _templates/studio/site-contract.json. Studio reads the page template, category fragment, metadata schema and styles from that contract at runtime. It discovers .system.json manifests from the website and generates imports using their entry paths. Preview revision tracking includes all systems/ files. Do not copy canonical templates or components into Studio.

Studio source, installers, private-control, drafts and credentials remain outside the public repository. The checked-in workflow validates indexes on main; it does not deploy. Studio's publisher is an explicit publication path and is not run for this maintenance task. Preserve the existing publishing boundaries and review before any push.

## Validation

Run npm test and npm run validate:references in the website. Run npm run validate in an isolated website copy, inspect its changes, then regenerate the actual site. Run npm test in Studio. Its test/site-integration.mjs accepts an isolated workspace root containing a site/ copy; it imports and renders published content and checks preview isolation. The reference validator checks local assets, imports, JavaScript syntax, metadata IDs, canonical contract targets and retired paths. It does not replace browser interaction checks.

Add reusable behavior under the smallest relevant systems/ responsibility. Add content-specific behavior beside that content. Shared systems must not depend on a particular story, game or tool. New page generation belongs in canonical _templates/ sources; data belongs in per-item metadata or content/ as appropriate. Keep pre-paint theme loading synchronous, storage keys and module execution order stable.
