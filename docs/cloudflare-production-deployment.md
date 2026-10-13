# Cloudflare production deployment

## Candidate deployment before live cutover

Worker: `fas-site-production`
Git branch: `codex/cloudflare-production-prep`
Build command: `npm run build:cloudflare-production`
Deploy command: `npx wrangler deploy --config wrangler.production.jsonc`
Preview command: `npx wrangler preview --config wrangler.production.jsonc`
Root directory: `/`

The production configuration is `wrangler.production.jsonc`. The default `wrangler.jsonc` intentionally still belongs to `fas-hosting-preview`. Do not change its name in response to a dashboard suggestion: the explicit production deploy command selects the separate configuration.

Production assets are staged into `dist-production`. Preview assets remain in `dist` and retain their noindex header. Production staging preserves the same 139 public files and omits the preview search exclusion. Neither configuration contains a custom domain or route.

Local production verification: 148 checks passed, including content hashes, absence of noindex/nofollow headers, story path redirects with query strings, custom 404 responses and blocked private paths. Wrangler dry run passed. Remote candidate verification is required after the first successful build:

`node scripts/verify-cloudflare.mjs https://fas-site-production.fromastoryteller-296.workers.dev --production`

Browse the candidate's stories, search, navigation, themes, mobile layout, games and tools. Record its successful website version ID; the initial Hello World version is not a usable website rollback target.

## Domain readiness

Ryan explicitly approved moving DNS management to Cloudflare while retaining GitHub Pages hosting. Nameservers are `khalid.ns.cloudflare.com` and `malavika.ns.cloudflare.com`. The four GitHub A records and the www CNAME are DNS-only. Universal SSL is active for the apex and wildcard. Ryan confirmed no custom-domain email addresses or forwarding are used.

## Cutover gate

The live domain remains on GitHub Pages. Obtain separate explicit approval before attaching the live domain, replacing its website DNS records, or enabling production routing. Verify apex/www HTTPS, HTTP-to-HTTPS and www-to-apex redirects preserving paths and queries, published-content hashes, assets, custom 404s, sitemap/canonicals and absence of search exclusion after cutover. Recheck robots.txt because Cloudflare's configured bot preferences may prepend managed directives.

Keep GitHub Pages, its custom-domain configuration and the original DNS values for rollback. If abandoning Worker hosting, detach its custom domains and intercepting rules, then restore the original four GitHub A records and www CNAME as DNS-only. A nameserver rollback is a separate action and need not be used for a hosting-only rollback.

Before marking migration complete, integrate the reviewed hosting changes into main and verify that future Studio/main publications trigger the correct production build. This preparation branch is temporary; it does not yet provide main-based publishing.
