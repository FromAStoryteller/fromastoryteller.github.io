# From A Storyteller CSS migration report

The Dropbox website source has been migrated to the four-file CSS architecture.
No GitHub commit or public deployment was performed.

## Verification and limits

- Checked all 27 full HTML pages/templates for stylesheet order, duplicate links and missing CSS or script paths.
- Parsed all ten remaining CSS files and checked CSS asset paths with case-sensitive local resolution.
- Confirmed five distinct, referenced font files, all with lowercase hyphenated filenames.
- Confirmed no retired-font references in inspected website source, metadata and documentation. Git history was excluded.
- All JavaScript syntax checks passed. Gameplay and tool JavaScript were not changed.
- Confirmed staged files matched local content hashes and originals had not changed since download before replacement. After applying the migration, 44 saved source/font/licence files matched the checked local copies, and a fresh Dropbox listing confirmed all 13 obsolete CSS paths were absent.
- Used the supported internal preview to load all 27 full pages/templates at 320, 768 and 1280 CSS pixels in both light and dark modes (162 page/viewport/theme checks). No missing linked CSS, failed font faces or horizontal page overflow was detected. Responsive widths used same-origin iframe viewports, not physical device emulation.
- Visually inspected the desktop homepage, phone homepage/story/Contact layouts, tablet About layout and desktop game/menu panels. Verified explicit two-line MonteCarlo branding and formal accessible link text.
- Tested sidebar expansion, light/dark switching and persistence across navigation, featured carousel controls, Games filtering, search returning Michael's Choice, countdown completion/reset and genre generation.
- Found and corrected legacy white text on pale About/Contact surfaces and About, Contact, Privacy, Terms and Search headings/intros. These now use the established theme text/accent tokens; deliberately dark panels retain light text.
- Independently rendered the actual shared game menu and exercised Settings, sound toggle, difficulty and Play controls. Both full games encounter the unchanged p5.sound library's AudioWorklet initialisation error in this HTTP preview. Gameplay, audio and fullscreen still need testing on the normal HTTPS deployment; no game code was changed to accommodate the preview.
- Physical touch/rotation, OS-theme changes, print output and exhaustive runtime CSS coverage were not exercised. Existing corresponding code and styles were preserved and statically reviewed. No public deployment was performed.
- Automatic time-of-day switching was not implemented before this work and remains unimplemented. Its filled-in theme-period foundations are retained. Manual light/dark and OS preference code are retained.

## Files changed

- `404.html`
- `README.md`
- `_template/page-template.html`
- `about/index.html`
- `blog/index.html`
- `components/header.html`
- `contact/index.html`
- `css/components.css`
- `css/foundations.css`
- `css/layout.css`
- `css/utilities.css`
- `games/brick-blitz/index.html`
- `games/games.css`
- `games/index.html`
- `games/rally-clash/index.html`
- `index.html`
- `privacy/index.html`
- `scripts/story-theme-controls.js`
- `search/index.html`
- `stories/a-place-left-behind/index.html`
- `stories/crypt-of-the-blood-jewel/index.html`
- `stories/date-night-jigsaw/index.html`
- `stories/index.html`
- `stories/michaels-choice/index.html`
- `stories/moon-hoc-meeting/index.html`
- `stories/onto-the-stage/index.html`
- `stories/stories.css`
- `stories/sunset-at-the-lighthouse/index.html`
- `stories/tea-at-the-summit/index.html`
- `stories/the-deal/index.html`
- `stories/the-labyrinth/index.html`
- `terms/index.html`
- `tools/countdown/index.html`
- `tools/genre-randomizer/index.html`
- `tools/index.html`
- `videos/index.html`
- `css-migration-report.md` (new report)

## CSS removed from the website project

These files no longer exist in the website project or its stylesheet links.
Original copies are retained in the rollback folder outside the website.

- `style.css`
- `content/content.css`
- `about/about.css`
- `contact/contact.css`
- `privacy/privacy.css`
- `terms/terms.css`
- `search/search.css`
- `tools/tools.css`
- `css/story-fonts.css`
- `css/story-theme.css`
- `blog/blog.css`
- `videos/videos.css`
- `games/_template/style.css`

The root `style.css` no longer exists in the project. Its live rules have been
migrated. The empty blog, video and game-template stylesheets were removed.
The shared content stylesheet and transitional font/theme sheets were migrated.

## Font paths

Folder casing is normalised to `assets/fonts/montecarlo`, `assets/fonts/literata`
and `assets/fonts/source-sans-3`. Font-family names inside CSS remain MonteCarlo,
Literata and Source Sans 3. Font bytes and all OFL.txt licence contents are unchanged.

| Previous path | Final path |
| --- | --- |
| `assets/fonts/MonteCarlo/MonteCarlo-Regular.woff2` | `assets/fonts/montecarlo/montecarlo-regular.woff2` |
| `assets/fonts/Literata/Literata-Variable.woff2` | `assets/fonts/literata/literata-variable.woff2` |
| `assets/fonts/Literata/Literata-Italic-Variable.woff2` | `assets/fonts/literata/literata-italic-variable.woff2` |
| `assets/fonts/source-sans-3/SourceSans3-Variable.woff2` | `assets/fonts/source-sans-3/source-sans-3-variable.woff2` |
| `assets/fonts/source-sans-3/SourceSans3-Italic-Variable.woff2` | `assets/fonts/source-sans-3/source-sans-3-italic-variable.woff2` |
| `assets/fonts/MonteCarlo/OFL.txt` | `assets/fonts/montecarlo/OFL.txt` |
| `assets/fonts/Literata/OFL.txt` | `assets/fonts/literata/OFL.txt` |

The two OFL.txt paths above change only with their containing folder; the licence
filenames and contents are unchanged. Source Sans 3/OFL.txt stays in place.

## CSS retained outside the main four

| File | Reason |
| --- | --- |
| `stories/stories.css` | Specialised reading column, paragraph indentation, scene breaks, story header/footer, reader links and print presentation. The content-card import is removed. |
| `games/games.css` | Canvas sizing, fullscreen, touch controls, device-rotation overlay and input-specific presentation. Shared shells and information panels were migrated out. |
| `games/shared/menu/menu.css` | JavaScript-generated game menus, sliders, choices, victory/defeat screens and container-responsive game UI. |
| `assets/fontawesome/css/fontawesome.min.css` | Vendor icon engine and common icon helpers. |
| `assets/fontawesome/css/brands.min.css` | Vendor social-brand icon mappings and font face. |
| `assets/fontawesome/css/solid.min.css` | Vendor solid UI-icon mappings and font face. |

Vendor CSS was retained intact to preserve icon mappings and third-party notices.
Dynamic game and carousel states were preserved. Known obsolete selectors,
repeated shared information panels and superseded declarations were removed.

## Remaining REVIEW decisions

| File and line | Decision |
| --- | --- |
| `css/foundations.css:281` | finalise light-mode sidebar shadow. |
| `css/foundations.css:344` | finalise dark-mode sidebar shadow. |
| `css/foundations.css:417` | finalise dawn palette; currently the functional light palette. |
| `css/foundations.css:607` | finalise dusk palette; currently the functional dark palette. |
| `css/components.css:2580` | finalise desktop wordmark size. |
| `css/components.css:2598` | finalise mobile wordmark size. |

## Later visual-design work

- Finalise the exact wordmark sizes after the successful desktop/tablet/phone preview checks.
- Decide how the retained dark feature panels should look in light mode; their existing gradients were preserved with readable text rather than redesigned.
- Harmonise the existing variety of card/panel radii, borders, gradients and spacing through the central tokens.
- Finalise dawn/dusk colours, then implement sunrise/sunset timing and continuous transitions as a separate feature.
- Review story reading width, title sizes and paragraph rhythm visually; existing reader geometry was retained.
- The privacy page still describes requesting Gabriela from Google Fonts. Font requests are now self-hosted. This legal wording was intentionally left unchanged and needs a content review.
- `games/_template/index.html` was empty before this work and remains empty; `_template/page-template.html` is the populated future-page template and now loads the four-file system.

## Rollback

Original changed/removed source files are under:
`/02 From A Storyteller/02 Website/css-migration-backup-2026-09-09/`.

To revert, replace changed files with their originals from that folder, restore
the removed CSS files, reverse the font-path mapping above, and remove this new
report. The backup deliberately sits outside the website project so old CSS
cannot be loaded or published accidentally.
