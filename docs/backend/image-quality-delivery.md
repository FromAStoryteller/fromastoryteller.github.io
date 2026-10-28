# Automatic contributor image quality and delivery

Cover uploads send the selected JPEG/PNG and crop position directly to the trusted processor. The client canvas is a preview; it no longer enlarges or JPEG-encodes the upload. The processor honours camera EXIF orientation, discards source metadata and saves a single quality-94 JPEG cropped master at 1600×900, 2400×1350 or 3200×1800, choosing the largest supported size that fits inside the original crop. A crop below 1600×900 is rejected. Profile crops require at least 512×512 source pixels and are converted once at quality 94. Existing 5 MiB/8-million-pixel limits remain.

Only the cropped master is retained. The uncropped original is processed in memory, not archived. A previously saved 1600px cover cannot gain detail: contributors must upload a sufficiently detailed source to obtain a larger master. Dimensions cannot establish that a photograph is in focus or free from pre-existing compression; neither enlargement nor a quality setting can recover missing detail. The policy prevents artificial upscaling and unnecessary repeated encoding; it is not a claim of lossless photo compression.

The browser receives candidate sizes up to the master’s measured width. Small cards and dense screens choose different sizes with `srcset`/`sizes`; an old 1600px asset never advertises itself as 3200px. Derived cover JPEGs use quality 88 and are generated from the saved master, not from a smaller derivative.

Production public cover markup uses `/api/public/image`. Cloudflare verifies the current public-content revision on every request, then reuses anonymous JPEG bytes from its local edge cache for up to 60 seconds. Changes to publication, access, account closure or image metadata rotate that revision, making earlier entries unreachable. Failure to check the revision closes access. The origin gateway independently checks anonymous asset visibility before and after processing. Browser responses remain `no-store`; private previews and profile images remain on their authenticated path. No reader token/cookie is forwarded into the shared cache.

Image cache misses invoke the processor in Sydney (`ap-southeast-2`), near the database/storage, rather than making multiple database round trips from an arbitrary execution region. Explicit regional routing has no automatic regional failover; a failed origin is never replaced with unchecked stale images.

This photo-cover policy does not rewrite creator package assets, pixel art, SVGs, manuscripts, PDFs, source code or downloads. Those retain their original bytes and require content-appropriate optimisation. Static repository images retain the separate AVIF/WebP derivative pipeline.

## Emergency delivery correction — 28 October 2026

Live parallel image requests exhausted the Supabase isolate CPU budget (546 `WORKER_RESOURCE_LIMIT`, shutdown reason `CPUTime`). The deployed story-image entrypoint now omits on-demand transformation and serves the stored master bytes unchanged, retaining both caller-scoped visibility checks, size limits, and no-store responses. Existing width URLs remain accepted for compatibility. This increases transfer size but avoids request-time codec work and preserves source quality. Pre-generated derivatives should replace request-time encoding in the next optimisation. The resize module remains available for offline tests, but is not loaded by the delivery entrypoint.

## Precomputed sizes

New Studio uploads now generate smaller JPEG crops in the contributor's browser at quality 94. The upload boundary verifies their bounded dimensions and stores them under the master's lifecycle. Only service-verified stored widths are used; a missing variant falls back to the unchanged master. Existing covers keep working and acquire sizes on re-upload. Delivery performs no decoding or JPEG encoding. See progressive-delivery.md for the complete loading and asset contract.
