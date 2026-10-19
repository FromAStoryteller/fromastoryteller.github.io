# Games and tools in Storyteller Studio

Implementation branch: feat/game-tool-upload-studio. Production remains unchanged until the release steps below are completed.

## Creator workflow

1. Open Storyteller Studio, choose Add content, then Game or (administrators only) Tool.
2. Content type and Publish as are visible above the editor. Administrators can choose their personal name or From A Storyteller; tools always use From A Storyteller. The existing explicit FAS publisher capability also remains available for other content. Account ownership, addresses and reporting stay unchanged.
3. Choose Landscape (1920 × 1080, 16:9) or Portrait (1080 × 1920, 9:16). Download the starter ZIP. Open index.html directly or use your editor’s local server. Work in main.js and style.css; keep local media in assets/.
4. Use FAS.canvas, FAS.ctx, FAS.width and FAS.height. Coordinates stay constant while the backing canvas supports up to 2× device density. Use FAS.pointer(event) for correct pointer coordinates after scaling. Use FAS.asset("name.png") for images/audio. CSS url(assets/name.png) references are rewritten to the included file inside the player. FAS.ui provides an optional DOM layer for tools.
5. Upload main.js, style.css and all media files together. This replaces the complete package. The optional fas.json restores the exported orientation; index.html, fas-runtime.js and README.txt are local development files and are not uploaded as executable entry points. Preview uploaded files, then Start. Restart, Stop and Fullscreen controls are provided by the platform.
6. Enter a title, description, controls/instructions, category and reviewed warnings. Save a draft, add a cover with alt text, then publish or schedule. Live file replacements take effect only after saving live changes. Failed saves retain the previously published package.
7. Download current files to return to your local editor. Automatic tab recovery and portable recovery include the package. Account content exports include the package in its content JSON metadata. Archive, restoration, account removal and public visibility use the existing content lifecycle.

## Boundaries and limits

- A self-contained, classic main.js (256 KiB), optional style.css (64 KiB), and up to 24 PNG/JPEG/WebP/GIF/MP3/OGG/WAV files (1 MiB each); complete encoded package up to 4 MiB. SVG, HTML, arbitrary URLs, remote modules and external dependencies are not executable uploads. Bundle dependencies into main.js in your own editor.
- Uploaded code runs only in a sandboxed iframe with allow-scripts and no allow-same-origin. Its CSP blocks network connections, frames, workers, forms and external scripts. No account tokens, privileged callbacks, cookies or storage access are passed to it. Messages are limited to displayed diagnostic text and checked against the exact frame and channel.
- CSS and JS strings are encoded as escaped JSON and applied as text inside the player, never inserted into the authenticated page. Player loading is on demand. Code is public when published: never include secrets.
- Offline games/tools are supported. Multiplayer, server APIs, account-based saves and durable browser storage require a future platform integration. Sandbox isolation is not a CPU/memory quota; creator code still needs performance testing.
- Admin and contributor permissions remain separate. An administrator uses Studio when they also have contributor access and current contribution agreements. Tools are admin-only on every write, including changes to an existing tool. The server forces the FAS byline. UI visibility alone is not authorization.
- Executable packages are bounded JSON in the existing story row. This first release keeps metadata, files and optimistic version checks atomic and inherits export/deletion/backup behavior. Larger asset libraries should move to versioned private object storage before increasing the limits. The account export size guard now includes executable bytes.

## Verification

- 186 automated checks passed, including PostgreSQL migrations and package isolation/escaping, bounds, ZIP source preservation, portable recovery, public routing and discovery.
- Local Chromium checks passed at 1440px and 390px: game creation, prominent identity switching, ZIP download, landscape/portrait scaling, denied parent-page access, stop/restart, FAS-only tools and contributor-hidden controls.
- Hosted DEV oqmmvjjycpyxvxipcyli: installed migration 20261019043825_interactive_uploads. The exact source is recorded in migration history. Named transactional SQL fixtures passed for game/tool publication, metadata, privacy, anonymous/viewer/cross-owner denials, FAS identity and revoked administrator access. All fixtures roll back. Security advisors report no error-level findings. Existing DEV accounts/content are preserved.
- Reference/syntax validation and content generation passed. Existing repository game/tool pages and slots are retained; no existing games are converted to uploaded packages.

## Production release

1. Complete the documented fresh encrypted backup and off-site verification for this release, following backup-restore.md. Keep the encryption password private. Capture the current Cloudflare deployment as rollback target. The existing production release procedure requires operator confirmation before database changes.
2. Read production migration history and check that executable_package is absent. Apply only the reviewed additive interactive_uploads migration to vzdicnufhidelaoeqbza. Preserve existing timestamp mappings: do not use blind db push or repair historical migrations. Record this new migration and its exact source once, after success.
3. Verify new columns, constraints, role grants, function definitions and catalog configuration with read-only checks. Run security advisors. No production fixture accounts/content should be created.
4. Merge the reviewed PR after its checks pass; the existing Cloudflare main integration deploys the site. The new frontend selects executable_package, so the database migration must precede deployment.
5. Verify live assets, existing game/tool pages, Studio and missing/private dynamic routes. Test a real creator upload with the operator when ready.
6. Roll back the frontend deployment or revert the release if needed. Retain additive database schema and uploaded data. Disable game/tool creation in studio_content_types if necessary while investigating; do not delete user packages or rewrite historical migration rows.
