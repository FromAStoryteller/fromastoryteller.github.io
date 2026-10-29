# Common font delivery

The existing MonteCarlo, Source Sans 3 and Literata typefaces are unchanged.
The historical `.latin.woff2` paths now contain common-character subsets rebuilt
from the retained full fonts by `scripts/build-font-subsets.py`. Install the
pinned dependencies in `scripts/font-subsets-requirements.txt` to rebuild;
`--check` verifies the committed bytes are reproducible.

MonteCarlo's common subset covers ASCII for the wordmark. The interface and
reading subsets cover Latin-1, Māori macrons, combining accents, punctuation,
currency, common arrows and the scene-break/end symbols. All original font
files and their OFL licenses remain available. Common and full-face Unicode
ranges are disjoint: the full face covers every other codepoint. This avoids
requesting the full font just to discover that it also lacks a decorative
symbol. Other supported text still loads the full face, including other Latin
accents, Vietnamese and Greek; coverage is not lost when the common range narrows.

Subsetting retains OpenType layout features, variable axes, glyph metrics and
font naming/license records. The appearance test compares rasterized text with
the original full fonts at 17 style/weight combinations and exercises extended
text fallback before loading its reference fonts. Both phone/desktop widths and
light/dark themes are checked. The normal build versions changed font bytes and
dependent stylesheets, including preload references, so existing visitors
receive matching assets.

The main-branch workflow verifies the exact deployed font hashes and stylesheet
URLs, immutable caching and real story/home browser loading after deployment.
The change adds no analytics, storage, cookies or personal-data processing.
Terms/privacy wording and existing consent choices are unaffected.
