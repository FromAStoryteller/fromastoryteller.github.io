# Shared content page layouts

Story pages now have one platform-owned layout in [page-layout.mjs](../../systems/content/page-layout.mjs), styled by [stories.css](../../stories/stories.css). It is shared by repository stories, dynamic Studio stories, server-rendered public reading pages and Studio's private page preview. A contributor supplies title/manuscript/description/cover/alt text/taxonomy/warnings and their permitted author identity; they do not supply the site's page HTML or CSS. Manuscripts remain a validated block model with escaped text, limited emphasis, scene breaks and one opening drop cap.

## Change a layout once

- Edit \`storyPageMarkup\` for the story/blog page structure; edit stories.css for its presentation. It includes cover/title/byline/date/reading time, description/warnings, manuscript, end marker, socials and collection navigation.
- Blog uses the same editorial surface with its own collection label and no fiction end label.
- Edit \`interactiveHeaderMarkup\` and \`contentLayouts\` for game/tool/video platform headers. Their actual game/tool implementations remain opaque content slots, not manuscript blocks. Existing controls/instructions are preserved.
- Run \`npm run validate\`: it builds the game entries, applies templates to existing file pages and refreshes the normal site indexes. Commit the generated files together with the template change. Repeat validation must leave no diff.
- Studio stories update through the Worker/template at request time; they do not require a Git commit for each story. Layout releases still deploy through Git/Cloudflare. Keep URLs, content IDs and author/traffic attribution stable.
- Games/tools/videos do not gain new contributor creation/upload permissions from this refactor. Their type-specific metadata/editor/publishing checks must be implemented separately before enabling a type.

Legacy story bodies stay byte-for-byte unchanged. The generator replaces page layout around trusted repository prose; it never imports that prose as a contributor draft or changes its ownership. Header copy for existing games/tools lives in each meta.json's \`page.tagline\` and \`page.intro\`, separate from the shared template and catalogue description. The Worker still projects live publishing identity and socials from the public-only backend.

The public reader is server-rendered with the same escaped manuscript and layout, then refreshed through the public-only client projection. No reader Authorization/Cookie is forwarded to the backend. Draft/moderation visibility, missing-story statuses, no-store and canonical redirects remain enforced.

## Independent game entries

Each shipped game loads one \`games/<slug>/game.js\`. Readable authoring sources are \`sources/games/<slug>.mjs\`; each owns its own menu definitions/controller and gameplay. \`npm run build:games\` bundles its local code and generic engine helpers with pinned esbuild into the one browser entry. Neither game imports the shared menu system or runtime helper modules over the network. The existing p5/p5.sound libraries and page CSS remain explicit platform dependencies; “one game JS entry” does not claim that those libraries/assets are embedded.

Modify one game's menu in its own source; it cannot change the other game's menu. The old menu-system files remain historical source for now, with no shipped game dependency. This avoids deleting unrelated references in a layout task.

Future contributor executable uploads require separate isolated hosting/sandbox/CSP/resource validation. Never insert uploaded JS into the authenticated site's origin or execute it in Studio. This work prepares independent game packaging; it does not enable executable uploads.

## Verification

Unit checks cover escaped titles/author/warnings, forbidden image/social schemes, manuscript emphasis/indent/scene behavior, type-specific selection, private crop preview and owned menu sources. Compare old/current legacy prose and interactive implementation slots with \`scripts/verify-content-layouts.mjs\` using the exact PR base. Desktop/mobile browser checks compare legacy and fictional Studio hero/prose dimensions and fonts, and exercise each independent game’s Play/Pause/Settings/Resume controls. The existing Community browser suite retains failed-save/session/recovery/stale-edit/lifecycle coverage.

No production draft, real account, mail or invitation is created by these checks. The full website CSS/theming pass remains Ryan's later personal work.

## Release checks

The 10 legacy manuscript bodies and all four game/tool implementation areas passed byte-for-byte comparison against base 0d421483103337cbae3e107a75c8e8db70b76548. Browser job 117751115318 passed legacy/Studio widths/fonts and both games' Play/Pause/Settings/Resume at 1280px and 390px; Community browser job 117751115616 passed preview, failed saves, offline retry, reload/session recovery, conflicts and lifecycle. Visual review of fictional desktop/mobile pages found a byline link inheriting the ordinary wine link colour over the dark hero; scoped metadata links now inherit the hero's contrasting text colour and retain a full touch target. Blank-cover previews use the ordinary secondary text colour. Server-rendered prose has an explicit template slot and a safe-manuscript/reader-credential regression check. No production test story is created.
