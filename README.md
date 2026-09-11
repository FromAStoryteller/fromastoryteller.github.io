# fromastoryteller.github.io
From A Storyteller - hand-coded portfolio and experiments. Learning as I go


## Website styles

Every full HTML page and `_template/page-template.html` loads these files once,
in order: `css/foundations.css`, `css/layout.css`, `css/components.css`,
`css/utilities.css`. Feature styles follow them, then the Font Awesome vendor
styles. Do not add a second global stylesheet or a CSS import for content cards.

Foundations owns the three self-hosted font families, theme and design tokens.
Layout owns shared page geometry and structural breakpoints. Components owns
wordmarks, controls, cards and visual UI. Utilities contains small helpers.
The header wordmark deliberately has two visible lines and one accessible formal
name, From A Storyteller. Written brand references retain that formal name.

`stories/stories.css` contains reading/scene-break/print presentation.
`games/games.css` contains canvas, fullscreen, rotation and touch behaviour.
`games/shared/menu/menu.css` contains the game menu, sliders and result screens.
The three stylesheets under `assets/fontawesome/css/` belong to the icon library.

`scripts/theme.js` currently cycles Light and Dark only. Saved Auto (device preference) is migrated to its effective light/dark appearance; new visits also start with a saved device-resolved choice. Set `AUTO_MODE_ENABLED` to `true` to restore the retained Auto cycle and OS listener. The control uses a sun for Light, a moon for Dark, and a monitor with an A for Auto.
Time-of-day interpolation is not yet implemented; automatic-period tokens remain
available and the shell fade inherits the active surface automatically.

## Shared site shell

Edit `components/header.html`, `components/sidebar.html`, and
`components/footer.html`, then run `node scripts/generate-site-indexes.mjs`.
This refreshes every live page, the 404 page and the page template. Generated
components are present before JavaScript loads, preventing shell layout shifts.

The four CSS files remain the global source of truth. Foundations defines shell
height, wordmark size, quill width/overhang, rule gap, fade depth, width tiers,
interaction colours and layer tokens. Layout defines geometry; components defines
visual controls; utilities supplies skip-link and reduced-motion helpers.
The rail disappears at 64rem, matching the existing large-tablet breakpoint.
Main content uses equal side clearances to remain centred while clearing the rail.

Insert an approved decorative `<img src="/assets/..." alt="">` inside
`[data-quill-slot="header"]` and `[data-quill-slot="footer"]`. No logo has been
invented. Tune the shared `--size-quill-width`, `--size-quill-overhang` and
`--size-centre-rule-gap` tokens after the actual asset is available. The header
slot is non-interactive, above the drawer, and the drawer's top clearance reserves
its overhang. Keep the artwork inside the reserved slot.

The body fade is a pointer-transparent shell overlay. The opaque sidebar and
header occupy higher layers. Every page starts beyond the full fade zone using
`--size-content-top`. The header does not change height when search opens.
The shell coordinates Escape, Tab containment, focus return, background inertness
and scroll locking. Native wheel/trackpad scrolling is preserved; smooth scrolling
applies to anchor navigation only and respects reduced motion.

For a local browser preview, install Node.js 22.12+ (or a current supported Node
release), run `npm ci`, then `npm run dev`. This is a development-only Vite server;
GitHub Pages still serves the same plain HTML, CSS and JavaScript. `npm run validate`
regenerates the published indexes and shared HTML. Commit regenerated pages too.

Validation for the September 2026 shell pass covered narrow 280/320px, phone,
tablet, the 1024/1025px rail boundary and desktop layouts; story, game, tool,
About, Contact, legal and error-page geometry; menu/search Escape and focus
return; search suggestion keyboard activation; light/dark/Auto cycling; stable
centred geometry while scroll is locked; and local link/CSS/syntax checks.
Auto remains device preference, not sunrise/sunset interpolation. Precise logo
geometry remains deferred until the real Guiding Quill is supplied.


## Escape focus and carousel controls — 11 September 2026

`scripts/focus.js` exports `restoreFocus(element, {silent})`. The shared shell uses
silent restoration only when Escape dismisses menu/search. The destination remains
focused; its temporary marker clears on blur, pointer input, or the next trusted
non-modifier/non-Escape key. Shared focus selectors exclude this marker while
ordinary keyboard navigation retains the intentional focus ring. Search inputs use
focus-visible, and duplicate component/game-menu focus rules inherit foundations.

Featured autoplay uses Font Awesome Solid play/pause in a token-styled circular
overlay inside the card. Regular icons are not installed; the filled circle variant
was visually compared and the plain glyphs retained for clarity at compact size.
Navigation contains only Font Awesome chevrons and the existing gold indicators.
Mobile actions reserve room for the overlay. The 7000ms interval, focus/hover guards,
offscreen checks and reduced-motion behavior remain unchanged.

Verification: 26 pages passed desktop-light/mobile-dark shell checks (52 cases);
carousel geometry and interactions passed both themes at 320, 768, 1024 and 1280px.
Browser checks covered Escape destination/ring suppression, subsequent Tab rings,
mouse search dismissal, arrow/Home navigation, stable play/pause dimensions,
non-overlapping CTA/overlay, autoplay, persistent pause and reduced motion. No page
JavaScript errors were recorded. The generator validated 14 published items without
changing generated files; Studio's 13 existing tests passed. Full game play/audio
acceptance was not performed. No Git publication was requested or performed.


## Escape, carousel cadence and footer follow-up — 11 September 2026

Shared focus state now suppresses Escape on the already-focused element, clears on real keyboard/pointer input or focus change, and preserves normal Tab rings. Featured autoplay uses one deadline timeout with a 7000ms dwell, manual/Play resets, preserved remaining time during hover, visibility, shell and keyboard interruptions, and pointer-aware focus. The pause button retains its touch target with a smaller 24px translucent visual. Desktop footer uses equal outer grid tracks. Studio consumes the canonical assets at runtime; no bundled copy needs updating.

Verification: Chrome Escape/Tab checks on six control groups at 1440, 1024, 768, 390 and 320px in both themes; desktop footer midpoint and overflow checks; controlled-clock 7s cycles, mouse navigation, pause/play, hover, reduced motion, keyboard and shell checks; simulated document visibility transitions; search/menu Escape dismissal. Site generator passed for 14 items; 13 Studio tests passed. Native background-tab throttling and every game/dialog were not exhaustively exercised. No Git commit or push performed.
