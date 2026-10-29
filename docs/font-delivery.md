# Common font delivery

The existing MonteCarlo, Source Sans 3 and Literata typefaces are unchanged.
The historical `.latin.woff2` paths now contain common-character subsets rebuilt
from the retained full fonts by `scripts/build-font-subsets.py`. Install the
pinned dependencies in `scripts/font-subsets-requirements.txt` to rebuild;
`--check` verifies the committed bytes are reproducible.

MonteCarlo's common subset covers ASCII for the wordmark. The interface and
reading subsets cover Latin-1, Māori macrons, combining accents, punctuation,
currency, common arrows and the scene-break/end symbols. All original font
files and their OFL licenses remain available. Full faces are declared first
with the complete Unicode range; the later common face takes precedence where
it contains the character. Other supported text still loads the full face.
This includes other Latin accents, Vietnamese and Greek, rather than silently
losing coverage when the common range is narrowed.

Subsetting retains OpenType layout features, variable axes, glyph metrics and
font naming/license records. The appearance test compares rasterized text with
the original full fonts at 17 style/weight combinations and exercises extended
text fallback. Both phone/desktop widths and light/dark themes are checked.
The normal build versions changed font bytes and their dependent stylesheets,
including preload references, so existing visitors receive matching assets.

The change adds no analytics, storage, cookies or personal-data processing.
Terms/privacy wording and existing consent choices are unaffected.
