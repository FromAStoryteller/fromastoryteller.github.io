# Storyteller Studio

Implementation and DEV verification: 17 October 2026 (New Zealand). Draft PR #26; production is unchanged.

## Editor and publishing

`/account/studio/` uses the existing verified account/session loader and contributor checks. Stories and blog posts are enabled. Games, tools and video have disabled registry entries until their own editors are implemented. Existing file-backed content is not imported.

The design uses the website shell, theme tokens, Literata manuscript typography and Source Sans controls. Desktop has a work library, manuscript and tabbed inspector. Mobile stacks the controls; paired fields share aligned label/control rows. Native controls, labelled warning-removal buttons, keyboard tabs, visible focus and save announcements support accessible operation.

- Visual manuscript supports paragraphs, headings, quotes, bold, italic and scene breaks. Shared CSS renders the editor and published page alike. Drop caps apply only to the very first paragraph, never after scene breaks. Scene breaks can show space only, dots, a diamond or a rule. Arbitrary manuscript HTML is never stored or rendered.
- Drafts may be incomplete. Publishing and scheduling require title, description, manuscript, 1–3 catalog genres/subgenres, reviewed content warnings and an owned, cleared 16:9 cover with alternative text. Language defaults to English. Parent genre labels, URLs, author, dates, word/read counts and search/share metadata derive automatically.
- Genres/subgenres count toward one combined maximum of three; suggested or custom tags are separate (maximum 12). Content warnings use a controlled dropdown with removable choices and an explicit review/none confirmation.
- Contributors can request another warning, see its decision and refresh the catalog. Admin tools have a checked, audited approval/decline queue. Request text is erased when its author’s account is deleted; separate admin audit events remain. Requests do not send email; pending requests are limited to five per contributor.
- Server-generated addresses follow the title until the first publication, then remain stable through title edits and unpublication.
- New work is a private draft. Draft autosave waits 1.8 seconds. Published and scheduled edits require explicit saving. Failed saves preserve typing; exact previous timestamps prevent stale overwrites. Conflicts stop writes until reopening. Unsaved text can be downloaded; it is not cached in local storage.
- Account switching, revoked access and session end clear private UI and image blobs. Network verification failures preserve unsaved text. The database checks ownership, live sessions, account state, current policy agreements and contributor role independently.
- Scheduling stores UTC plus the browser's IANA timezone, shows local time and stays private until the server publishes. The minute cron rechecks eligibility, requirements, moderation and cover clearance. Contributor removal cancels schedules; reinstatement does not republish.
- Covers accept JPEG/PNG up to 5 MiB and 8 million pixels. The server decodes, crops and re-encodes JPEG 1600×900, strips source metadata and records dimensions through a service-only registration function. Images remain private pending administrator clearance. This is not an automated content-safety classifier.
- Social links are optional profile fields, shown on the storyteller and their content pages; bounded HTTPS platform URLs are validated on both client and server.

## Evolving requirements and growing libraries

`studio_content_types` stores each type's enabled state, metadata version, required built-ins, allowed genre IDs and typed custom fields. Custom fields support bounded text, integer and catalog selection; the editor renders their labels and requirements automatically. Only trusted server operations can change this registry. New editors still need implementation before enabling non-prose types.

When requirements change, increase the type's metadata version. The owner library and selected piece show **Details need updating**. Existing published work remains available. Before saving live edits, publishing or scheduling, missing requirements must be completed; only the server acknowledges the new version. Incomplete private drafts remain saveable. The database rehearsal covers a new required selection added to an already-published blog post.

The work library uses owner-only server search, content-type/status/needs-update filters and 20-row keyset pages ordered by update time and ID. It does not download all manuscripts to filter in the browser. A 45-item fixture verifies three pages without duplicates or omissions. Concurrent edits can move work toward the front; Refresh starts a fresh listing.

## Traffic, advertising and future monetization

Insights can display overall, per-content and storyteller-page views, engaged visits, completed reads, daily trends, devices, social/referral sources and ad impressions over 7/30/90 days. These are verified aggregate imports, never browser-submitted counts. No provider is connected: the interface reports that honestly rather than showing fabricated zeros.

Site-managed advertising is the intended model. Content and storyteller-page reports are attributed to the contributor's stable beneficiary ID; FAS-owned home/search/tools/site pages have no contributor beneficiary. Reporting rows cannot be reassigned after import. Revenue is stored by currency and shown only when monetization is explicitly enabled. This foundation does not implement ad delivery, payable balances, revenue-sharing terms, payment-provider integration or payouts. Those require a separate provider and policy decision before activation. Raw visitor identity is not collected here.

The Cloudflare reading worker derives crawler-visible title, description, canonical URL, Open Graph/Twitter cover and Article/BlogPosting structured metadata from the anonymous published projection. It accepts only the exact production origin and deliberately enabled production runtime config, never forwards reader sessions and uses no privileged key. It does not cache dynamic reading metadata. Drafts/unavailable pages return noindex; branch previews stay disconnected. The static fallback also stays noindex.

## DEV installation and checks

| Repository migration | DEV recorded version |
| --- | --- |
| `20261017024843_story_studio_metadata.sql` | `20261017025709` |
| `20261017032053_storyteller_studio_publishing.sql` | `20261017034654` |
| `20261017032357_studio_reporting_foundation.sql` | `20261017034705` |
| `20261017033843_studio_catalogs_and_metadata_versions.sql` | `20261017034716` |
| `20261017035818_studio_warning_request_retention.sql` | `20261017035856` |

Do not rewrite migration history timestamps. DEV has `fas-studio-cover` v2 deployed with JWT verification enabled. `supabase/ops/studio-publication-cron.sql` installs only the named `fas-community-publication` minute job and refuses conflicting configuration. No production database, function, cron or website deployment was performed.

Local PostgreSQL tests cover publication requirements, safe manuscripts, catalog bounds, immutable URLs, scheduler timing/idempotence, role removal, version upgrades, warning review permissions, owner-only paging and immutable report attribution. The same transactional v2 SQL suite passed against hosted DEV and rolled back its named fixtures; DEV story and warning-request counts remained zero. Handler tests cover identity/ownership before decoding, verified output and exact-object cleanup. Metadata-worker tests cover safe escaping, credential isolation and private/preview exclusions. Desktop and 390px mobile browser checks found no horizontal overflow; paired controls align, and only the opening paragraph has the large initial.

Supabase advisory notices for intentionally protected private tables and checked SECURITY DEFINER workflows remain expected: [public projections](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [checked workflows](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). The pre-existing [leaked-password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is unchanged.

The user's earlier guarded v1 API run passed. The expanded suite passes 126 tests; 1,005 local references and 154 JavaScript syntax checks pass. Both static build variants pass. The updated contract needs a fresh authenticated DEV API run. The local Wrangler bundle check encounters Windows ancestor-directory access restrictions; GitHub CI run 92 passed the complete suite, reference/index/build checks and the dry-run worker bundle check on Linux. This sandbox cannot retrieve the private CLI credentials (outbound access is denied); run from the user's authenticated terminal in this checkout:

```powershell
node scripts/run-fas-dev-tests.mjs --studio-only
```

The runner fixes the project to FAS DEV, holds credentials only in memory, sends no email, creates disposable accounts and verifies exact fixture cleanup. The Studio test uploads a tiny generated PNG through the actual cover service, verifies private JPEG 1600×900 output, checks required clearance, and deletes/verifies only its disposable cover objects. Approval is seeded through the privileged fixture setup; a genuine contributor/admin crop and clearance browser check remains required before release. The separate security/admin API fixtures use metadata-only synthetic covers. The full runner also rehearses existing account/security/admin flows; their exact-ID audit cleanup remains documented separately.

Before production: complete the new guarded API and authenticated browser checks, review the draft PR, install the identical migrations and cover function in production, install its own cron and deploy the reviewed Cloudflare build. Keep the task in progress until those release checks pass. Preview test fixtures are excluded from public builds.

## Cover runtime correction

The first guarded upload on 17 October exposed an import-time failure: the npm ImageScript entry selected native Node codecs (`unsupported arch/platform`). It failed before handling the image; fixture accounts, stories and assets were removed and no test Storage object remained. The bucket contained only its pre-existing `.emptyFolderPlaceholder`. DEV v2 selects the pinned Deno/WebAssembly distribution instead. A separate Deno 2.1.4 CI smoke test now imports the real deployed normalizer and runs PNG-to-JPEG and JPEG-to-JPEG 1600×900 checks; handler mocks alone could not detect this startup problem. Production is unchanged.
