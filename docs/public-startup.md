# Public page startup

The build parses static ES-module imports with esbuild and emits low-priority,
versioned modulepreload hints for public page dependencies. Dynamic account SDKs,
editor packages and below-screen enhancements retain their existing lazy paths.
The production browse entry is also explicitly preloaded where it is required.
Frozen account/policy pages are excluded. Hints download code without executing it.

On browse/search pages a small trusted inline bootstrap starts the same anonymous
public query before the full module graph finishes. The normal query module
validates and consumes that exact response once; it is not a persistent cache.
Query changes abort and discard unmatched results. Consumer cancellation and page
departure abort the original request. A restored page makes a fresh read.
Credentials remain omitted and server publication/revision checks are unchanged.

The bundled game loader loads the upload/editor package module only for a
published replacement. Once the lookup selects the bundled game, the p5 core,
sound library and game module download concurrently through preload hints.
Execution remains ordered after the public decision. Replacement packages never
download the old game libraries. Sound media already loads on interaction and
retains that behaviour.

Validation covers early public reads, one-request consumption, changed/empty
queries, errors/retries, navigation cancellation, static/dynamic module boundaries,
bundled/replacement players, early Play interaction and sound media. The main
workflow waits for the exact deployed modules and measures real homepage/search/
game loading with the same slow-mobile settings used before release.

No new analytics, personal-data processing or persistent browser storage is added.
Existing privacy/terms and the server-side permission model are unchanged.
