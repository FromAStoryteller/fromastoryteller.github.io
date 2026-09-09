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

`scripts/theme.js` supports saved light/dark choices and OS preference.
`scripts/story-theme-controls.js` maintains header controls and measured height.
Time-of-day interpolation is not yet implemented. The automatic-period tokens
are retained for that later feature. Search `REVIEW:` in CSS for design decisions.
