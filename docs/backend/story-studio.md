# Storyteller Studio

Status: **V1 complete and accepted on 18 October 2026 (New Zealand)**. Studio is deployed in production. See [V1 acceptance and follow-ups](studio-v1-handover.md), [initial production rollout](studio-production-rollout-2026-10-17.md) and [publishing-name rollout](publishing-identities-release-2026-10-17.md) for the current evidence and migration mappings.

## Library and editor

Studio opens on a full-width work library. Selecting Community work opens its editor; existing file-backed work opens publishing settings and insights.  Add content opens a content-type chooser first. Stories and blog posts are enabled. Games, tools and video remain disabled until their own editors exist. The owner library uses server search, type/status/needs-update filters and 20-row keyset pages rather than downloading all manuscripts. Overall reports are available from the library. Per-piece insights and report choices appear only after first publication, including previously published pieces now in draft.

The design uses the existing shell, theme tokens, Literata manuscript typography and Source Sans controls. Actions and the Profile & social links navigation shortcut share outlined button styling and aligned spacing. Navigation destinations retain link semantics. Labelled native controls, keyboard tabs, visible focus, save announcements and desktop/mobile layouts support accessible operation. The warning-review checkbox has an explicit span and a bounded checkbox height, overriding inherited 44px input sizing so its mark aligns with the first line of text.

The visual manuscript supports paragraphs, headings, quotes, bold/italic and scene breaks. Only safe structured blocks are stored. The editor, private preview and public page share reading CSS. Paragraph layout is standard: a nonempty paragraph immediately following another nonempty paragraph indents; the opening paragraph and paragraphs after a blank paragraph, heading, quote or scene break do not. This is updated while typing, including browser-created DIV paragraphs. Blank paragraphs retain their line of space. There is no paragraph-format choice; legacy database values remain readable but new saves normalize to the standard. Drop caps apply only to the very first paragraph, never after scene breaks. Scene breaks can use space only, dots, a diamond or a rule.

Drafts may be incomplete. Draft autosave waits 1.8 seconds; published/scheduled edits require explicit saving. Failures preserve typing. Exact previous timestamps prevent stale overwrites and conflicts stop writes until reopening. Private previews include unsaved work. Text and structured recovery files can be downloaded. Automatic tab-only recovery uses account-scoped sessionStorage, not localStorage, with honest storage-failure feedback. Recovery file and text controls are grouped under More options. Saved work reopens through an owner-checked Studio URL. Session expiry clears the private editor/images and locks unsaved recovery until the same account is independently verified; explicit Studio sign-out and account switching discard it. Network verification failures preserve typing. See [edit/autosave recovery](studio-edit-autosave-recovery.md) for limits and acceptance evidence.

Saved, never-published, unscheduled drafts can be deleted through an explicit confirmation, with Download text and Keep draft available. Deletion checks owner, version and draft state; stale saves cannot delete a newer version. Previously published work retains its permanent address and history. Registered cover metadata cascades, while physical orphan-byte cleanup remains separate. See [draft deletion](studio-draft-deletion-2026-10-18.md).

## Publishing without approval

Contributors publish their own content and upload covers without administrator approval. Publishing/scheduling require title, description, manuscript, 1–3 catalog genres/subgenres, reviewed warnings and an owned, server-verified 16:9 cover with alternative text. Language defaults to English. Author, dates, parent genre labels, URLs, word/read counts and search/share metadata derive automatically. Suggested/custom tags are separate, with a maximum of 12. Social links are optional bounded HTTPS profile fields shown on storyteller and content pages.

Covers accept JPEG/PNG up to 5 MiB and 8 million pixels. The fixed 16:9 crop preview supports mouse/touch repositioning, keyboard focus sliders and Centre image. Only useful movement axes are enabled; an exact-ratio image uses the full frame. Preview and upload share geometry. The Edge service independently authenticates the active owner/session, decodes, crops and re-encodes JPEG 1600×900, strips source metadata and registers service-only dimensions/verified_at. This is automatic file verification, not human content review. Existing normalized uploads are marked verified based on their previously service-only dimensions; older staff-cleared assets retain compatibility. Legacy approval columns/RPC remain for older records, but Studio never asks contributors to use them.

The bucket remains private. Anonymous byte delivery rechecks RLS before and after buffering. A new verified cover becomes public only when it is the saved cover of published, eligible content. Unselected alternatives and unpublished covers stay private. Legacy approved inline assets retain their former visibility rules. Contributors cannot forge verification/dimensions or attach another author's cover. Admin moderation can still unpublish/lock content.

Scheduling stores UTC plus the browser IANA timezone and stays private until the minute cron rechecks eligibility, metadata, moderation and verified cover requirements. Contributor removal cancels schedules; reinstatement does not republish.

## Permanent addresses and attribution

Community stories use /stories/title-name/; blog posts use /blog/title-name/. Slugs follow the title until first publication. After first publication, the slug and content type are fixed, including through unpublication. Title edits change the displayed title/search metadata and keep the address, content ID and report attribution. The UI explains this beside the address and disables the published content-type selector.

A database unique constraint and serialized global allocation prevent duplicate slugs across owners. A collision adds the full content UUID suffix, with a checked numeric fallback for adversarial titles. Existing file-backed story names are reserved in private.studio_reserved_addresses; their static pages take priority in the Worker. Add future file-backed names to the reservation table through a migration before deployment. Existing file-backed content is not imported or moved.

The Worker serves the shared reading shell at community paths and queries only the anonymous published projection. Old /read/?story= links redirect with HTTP 308 to the type-specific canonical URL; referral parameters survive the redirect. A missing trailing slash redirects to the canonical slash. Wrong content-type paths and private/missing content return 404/noindex. Published JSON and reader markup expose the stable public content ID for future provider attribution. Local Vite previews use the same path parser, while preserving existing static files.

Only the exact production origin with deliberate production runtime configuration receives crawler-visible title, description, canonical, social cards and Article/BlogPosting metadata. Reader credentials are never forwarded and dynamic metadata is not cached. Branch previews remain disconnected/noindex.

## Personal and FAS publishing names

Private account ownership is separate from the public byline. Personal attribution is the default. The explicitly authorized site-owner account can select From A Storyteller for its other content; tools always use that organization identity. Public bylines, socials, profiles and structured metadata use the selected identity. Private owner IDs, email and permissions stay outside the public projection.

The ten existing stories and two games belong to the operator account and default to Ry. The two tools use FAS attribution. These source-file pages remain at their existing URLs and use the server byline/eligibility gate. Studio offers their publishing settings and insights; it does not import their body/game code into the manuscript editor. All supported content routes reach the Worker. Changing the byline preserves ownership, page/report identifiers and URLs.

## Evolving requirements, warnings and reporting

studio_content_types defines enabled types, metadata versions, required built-ins, allowed genres and typed custom fields (bounded text, integer or catalog selection). Missing requirements are rendered automatically. Version changes flag Details need updating in the owner's list and editor, while existing published work remains available. Required details must be completed before live saves, publishing or scheduling; only the server acknowledges the new version.

Content warnings use a shared dropdown, removable choices and an explicit reviewed/none confirmation. Contributors can request a warning and see its decision. An audited admin queue approves/declines catalog requests; this is separate from publishing/upload approval. Pending requests are limited to five and request text is erased on account deletion. No request emails are sent.

Insights support own content/profile/all-page aggregate imports, views, engagement/completion, dates, devices, sources and future ad impressions/revenue. Provider reports use stable content/profile IDs and beneficiary attribution; imports cannot be reassigned. No analytics provider is connected, so the interface reports that honestly. Advertising delivery, revenue-sharing terms, payable balances, payment providers and payouts are not activated. No raw visitor identity is collected here.

## DEV installation

| Repository migration | DEV recorded version |
| --- | --- |
| 20261017024843_story_studio_metadata.sql | 20261017025709 |
| 20261017032053_storyteller_studio_publishing.sql | 20261017034654 |
| 20261017032357_studio_reporting_foundation.sql | 20261017034705 |
| 20261017033843_studio_catalogs_and_metadata_versions.sql | 20261017034716 |
| 20261017035818_studio_warning_request_retention.sql | 20261017035856 |
| 20261017083044_studio_unique_content_addresses.sql | 20261017083610 |
| 20261017091956_studio_self_service_addresses.sql | 20261017092441 |

Preserve installed migration mappings; never rewrite history. DEV fas-studio-cover v3 retains JWT verification and its pinned Deno/WebAssembly normalizer. The old npm codec import failed at startup; real Deno PNG/JPEG smoke tests now cover it. Earlier owner-RLS address collisions were fixed with privileged, non-callable allocation; cleanup checks use exact Storage directory listings instead of cached downloads. The named minute cron is documented in supabase/ops/studio-publication-cron.sql. Production database, cover function, publication cron and website are now deployed; the linked rollout records above preserve the exact production versions. Do not infer installed production timestamps from repository filenames.

## Verification and V1 acceptance

The initial pre-launch verification passed 130 local Node tests; 1,017 references and 160 JavaScript syntax checks pass, as do both build candidates. Tests include PostgreSQL ownership, publication, automatic verification without admin approval, unselected/private covers, immutable URLs/types, static reservations, collision handling, scheduler timing/idempotence, report ownership, requirement upgrades, warning decisions and pagination. Worker tests cover canonical redirects/referral retention, static precedence, correct type paths, private/preview exclusions and safe metadata. Paragraph tests cover contiguous, blank-separated, scene/heading-separated and browser-DIV paragraphs. The expanded transactional suite also passed against hosted DEV and rolled back. The user's existing one story and one asset remained present; its normalized cover is now automatically verified.

Browser checks verified no per-piece insights on a never-published draft, insights on a published piece, a disabled published type selector, absent paragraph-format and approval controls, live no-indent after a blank paragraph, and the corrected checkbox dimensions. The real existing DEV draft shows its cover as Ready to use without an approval action. Existing draft content was not edited or published during this check.

The updated authenticated DEV API suite passed on 17 October after these contract changes: real normalized JPEG cover upload, server-only verification, publication without admin approval, private scheduling, live edits, stale-version rejection, unpublication, moderation and contributor removal. Exact fixture/Storage-byte cleanup passed. The original one story and one asset remain; no test identities were retained. Private CLI access was recovered through the installed offline CLI entry point, so the test ran here with process-only credentials and no credential files or output.

The repeatable user command remains:

~~~powershell
node scripts/run-fas-dev-tests.mjs --studio-only
~~~

Fresh DEV browser checks confirmed the real existing cover is Ready to use, no approval control exists, and never-published insights are hidden. Standard paragraph and checkbox layouts were checked in the preview; mobile dimensions/overflow were checked in real DEV without editing the user's draft. There is no admin-clearance step. Production installation and deployment are complete. The final publishing release passed 140 CI tests, including the content-route regression, plus hosted DEV fixtures and desktop/tablet/mobile controls. Read-only live verification passed all 14 existing pages, both public publishing profiles and exact deployed Studio sources. The existing production draft was preserved.

Security advisory categories are unchanged: intentionally protected private tables ([RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)), checked anonymous/authenticated SECURITY DEFINER workflows ([anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)), and the pre-existing [leaked-password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The new reservation table is private, RLS-enabled and inaccessible to API roles.
