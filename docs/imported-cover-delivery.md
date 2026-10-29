# Imported editorial cover delivery

Original imported cover IDs are registered in `systems/community/public-story-catalog.mjs`.
After a fresh public discovery response validates publication and author visibility,
the card converter may select the registered repository image for that exact cover
asset ID. This gives the static first paint and hydrated card the same versioned
AVIF/WebP sources. It avoids fetching an extra JPEG of the same original.

The mapping is by immutable original cover asset ID, never just story ID or slug.
A new uploaded cover uses a different ID and continues through the live gateway.
DEV and local image services do not use this production registry. Fresh cover alt
text still comes from the live response. The registered repository source is
1600x900; runtime width metadata does not overstate its available source pixels.

Registry tests lock each source to its Git blob hash and original import seed.
If a source image changes, remove its mapping or revalidate equivalence before
updating the registry. Browser validation compares public originals against the
registered images and tests normal startup, replacement covers and withdrawal.
Desktop cards can legitimately select a smaller variant than the featured image;
one request per selected resolution is expected.

No authentication, revision checks, gateway permissions, cache rules or policy
wording change. These original repository images were already publicly served.
`verify-cover-delivery.mjs` waits for the exact main-branch asset version and checks
the live homepage at phone/desktop widths after deployment.
