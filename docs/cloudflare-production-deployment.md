# Cloudflare production deployment

## Live publishing configuration

Worker: `fas-site-production`
Git branch: `main`
Build command: `npm run build:cloudflare-production`
Deploy command: `npx wrangler deploy --config wrangler.production.jsonc`
Preview command: `npx wrangler preview --config wrangler.production.jsonc`
Root directory: `/`

The production configuration is `wrangler.production.jsonc`, including the approved `fromastoryteller.com` custom domain. The default `wrangler.jsonc` belongs to the separate `fas-hosting-preview` Worker. Keep the explicit production deploy command when editing Cloudflare build settings.

Production assets are staged into `dist-production`; preview assets remain in `dist` and retain their noindex header. The staging build preserves all 139 public files and excludes repository metadata, maintenance scripts and private paths. Production omits the preview search exclusion.

Commits to main now select the production build. Changes to content published through Studio must reach main to be included. A successful build is required before a change is live; check the Cloudflare build log if an update does not appear.

## Completed cutover and verification

Ryan approved the DNS handover and live hosting cutover. Nameservers are `khalid.ns.cloudflare.com` and `malavika.ns.cloudflare.com`. The apex is attached to fas-site-production. The www CNAME remains pointed at `fromastoryteller.github.io` with Cloudflare proxy enabled; the deployed redirect rule sends www to the HTTPS apex while preserving paths and query strings. Always Use HTTPS is enabled. Universal SSL is active.

Existing tests: 16 passed. Local production verification and the deployed workers.dev candidate each passed 148 checks. Live checks confirmed 138 public files byte for byte, story-path redirects, private-path/custom 404 responses, and HTTP/www redirects without loops. The remaining public file, robots.txt, intentionally has Cloudflare's managed bot-preference prefix; retain the original allow/search and sitemap directives when reviewing this difference.

Main build confirmation remains required after the first post-switch commit. Open Cloudflare Deployments and confirm its branch is main and its status is Ready, then verify the live site.

## Verification and rollback

Run `npm run build:cloudflare-production` before checking a deployment. For the workers.dev production endpoint:

`node scripts/verify-cloudflare.mjs https://fas-site-production.fromastoryteller-296.workers.dev --production`

The same verifier can check the live apex, where the configured managed robots.txt prefix is an expected hash difference that must be reviewed separately. No other public-file hash differences are expected.

Keep GitHub Pages, its custom-domain configuration and the original DNS values for rollback. To restore GitHub Pages hosting, detach the Worker custom domain and disable intercepting redirect rules, then restore these four apex A records as DNS-only: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Restore the www CNAME to `fromastoryteller.github.io` as DNS-only. A nameserver rollback is separate and is not required for a hosting rollback.

Preview rollback was rehearsed successfully. Record successful production website versions for later rollback; the initial Hello World version is not a usable website rollback target. Supabase community accounts and data remain a separate planned implementation.
