# FAS Community V1: Cloudflare migration

Historical migration plan prepared 13 October 2026. The hosting cutover has since
completed; the observations, proposed steps and acceptance status below describe
the pre-cutover state, not the current deployment. For current hosting configuration
and completed evidence, use [production deployment](cloudflare-production-deployment.md).
For the completed database setup, use [backend operations](backend/operations.md).

The contributor self-publishing proposal below differs from the implemented
submission/moderation database workflow. Keep it as historical planning evidence;
confirm publication/editing rules during the security task before changing permissions.
Open viewer registration with invitation-only contributors remains the intended
account model; public signup is disabled until the account flows are built and tested.

## Decision and how it works

Choose **Cloudflare Workers with Static Assets**. Cloudflare recommends Workers for new projects; Pages remains supported, but starting on Workers avoids another platform migration when server routes are needed. The existing site is plain HTML/CSS/JavaScript, so it needs no framework conversion or Vite production bundle. At this stage no Worker script is necessary.

Think of Cloudflare as the shelf that delivers the website files, and Supabase as the accounts and story database. Hosting the shelf first does not create the community features.

| Responsibility | Proposed owner |
| --- | --- |
| Existing public pages, fonts, images, games and tools | Workers Static Assets |
| Viewer accounts, sign-in, sessions | Supabase Auth |
| Contributor stories and public profiles | Supabase Postgres with Row Level Security (RLS) |
| Contributor images | Supabase Storage with ownership policies |
| Account export/deletion, role grants, moderation, transactional email | Authenticated Supabase Edge Functions; server-only secrets |
| Future server-rendered story URLs, metadata and sitemap | A Worker route using Supabase; added in the community implementation |

Browser code uses a publishable key and the user's session. Database policies, rather than hidden buttons, enforce ownership. Never ship a secret/service-role key in the site or desktop Studio. Keep role grants outside editable profile fields. Administrative functions must authenticate and authorize their caller before using elevated privileges.

For Community V1, contributors publish their own stories and edits become visible immediately. A separate optional admin capability permits unpublishing/removing for moderation, not editing another writer's text. Viewers may register openly. Account deletion offers export first, then removes owned stories and assets. Studio's new community path handles stories only; existing website games/tools remain available.

Keep the 10 existing story URLs and their static content during this hosting migration. Later, reserve a non-colliding namespace such as `/stories/community/<id>-<slug>/` for database stories. These must have server-rendered metadata, public-only reads and a combined catalogue/sitemap. Publishing must invalidate relevant caches or use uncached reads so edits and moderation take effect immediately. Do not give contributors GitHub credentials or route each publication through Ryan's desktop approval. Connect Studio to authenticated Supabase publishing in a separate implementation. Do not run privileged operations in both Workers and Edge Functions without a clear owner.

## Inspected configuration

- Repository: `FromAStoryteller/fromastoryteller.github.io`, branch `main`, baseline commit `a40412bf201156f76aac9c42a39a7a9111d5369d`.
- `CNAME`, sitemap and canonical URLs use `fromastoryteller.com`.
- 14 published content items: 10 stories, two games, two tools. There are 30 public HTML files (27 pages and three components) and 139 public files in the deployment allowlist.
- Existing GitHub workflow validates indexes on main; it contains no deployment job. GitHub Pages source settings were not accessible through the connected tool, so confirm source branch/folder and HTTPS setting in Settings > Pages before cutover.
- Studio README describes Git-based publication and separate private drafts/control. The control README describes local-only scheduling. No Supabase client, configuration or migrations were found in the website repository. This does not establish whether a Supabase account/project exists elsewhere.
- Public DNS: apex A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; `www` CNAME `fromastoryteller.github.io`; nameservers `dns1.registrar-servers.com` and `dns2.registrar-servers.com`. Observed TTL approximately 1800 seconds. No apex AAAA answer was returned.
- Five MX records point to `eforward1` through `eforward5.registrar-servers.com`, priorities 10/10/10/15/20. SPF TXT is `v=spf1 include:spf.efwd.registrar-servers.com ~all`; two Google verification TXT records exist. Preserve these and export the full registrar zone before changes. DNSSEC/DS and CAA remain to be checked. Public queries are not a complete zone export.
- No Cloudflare credential names were present in the execution environment. Cloudflare dashboard inspection failed with a browser connection policy error. Local GitHub CLI authentication failed; connected GitHub access works. Supabase plugin discovery found an available, uninstalled connector; no database was inspected or modified.

## Implemented preparation

`scripts/build-cloudflare.mjs` stages only tracked, allowlisted public paths into `dist`, preserving their bytes and directory paths. It excludes Git data, maintenance scripts, dependencies, Studio templates, CNAME and private folders. The manifest records file sizes and SHA-256 hashes outside the served folder. The allowlist is not a general secret scanner: review new public files before committing them.

`wrangler.jsonc` points to `dist`, enables the isolated `fas-hosting-preview` workers.dev address, uses directory trailing-slash behavior and the existing 404 page. It includes **no routes, custom domains or production environment**. Preview headers use `noindex, nofollow`. Keep production canonical URLs in preview HTML. Search exclusion is not access control; the preview contains existing public content only.

The workflow validates pull requests and uploads the deployment package. It deploys only on manual workflow dispatch and only to this preview Worker, using `CLOUDFLARE_PREVIEW_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Creating credentials or connecting GitHub requires account access. No secrets have been added and no workflow has been dispatched. Review the diff before merging.

The `.gitattributes` addition fixes HTML/CSS/TXT line endings to LF so Windows checkouts preserve the same bytes served from Linux. A compatible lockfile update fixes the reported source-map-js advisory; final installation audit reported zero vulnerabilities.

## Preview steps — no DNS change

1. Review the draft pull request and confirm the baseline is still current. Install dependencies with `npm ci` using Node 24.
2. Run `npm test`, `npm run validate:references` and `npm run validate`; require generated content to be current. Run `npm run build:cloudflare`.
3. Run `npm run preview:cloudflare`, then in a second terminal run `npm run verify:cloudflare -- http://127.0.0.1:8787`. Stop the preview server before rebuilding on Windows.
4. Sign into the intended Cloudflare account. Check whether `fas-hosting-preview` already exists; use a different reviewed name if it belongs to other work. Confirm plan/limits before enabling paid services. Deploy this static preview with `npm run deploy:cloudflare-preview`, or configure the two workflow secrets and manually dispatch the preview workflow. No custom domain is attached at this step.
5. Record the resulting workers.dev URL and version ID. Run `npm run verify:cloudflare -- https://<actual-preview-host>` and save its report. This tests the real edge deployment, not only the local emulator.
6. Browse home, all 10 stories, listings/search, fonts, images, themes, mobile layouts, both games and tools. Check developer-console errors and external links. Verify live HTTPS, redirect chains, content types and any media range requests. These browser checks remain outstanding.

The comparison command checks every staged file's status and byte hash, preview noindex headers, representative story redirects with query strings, and custom 404 responses for missing/private paths. Run `node scripts/verify-cloudflare.mjs https://fromastoryteller.com --baseline` to compare the current production site without preview-header requirements.

## Production plan — explicit Ryan approval required

Workers Custom Domains require an active Cloudflare zone. Since the domain presently uses registrar nameservers, moving it to a Cloudflare-managed zone is a separate DNS change. The domain can remain registered with the current registrar. Do not change nameservers, DNS records or attach either production hostname without Ryan's explicit approval; attaching a Custom Domain creates DNS records and certificates automatically.

1. After the remote preview passes, export the registrar zone, record GitHub Pages settings, capture DNS/HTTPS/redirect evidence and preserve the baseline Git commit plus the tested deployment artifact. Confirm Cloudflare account, zone, billing and domain ownership. Check DNSSEC/DS handling before a nameserver move.
2. Prepare a separate production Worker configuration/name, preserving the static settings. Generate production headers without `X-Robots-Tag: noindex`; never attach the preview build to the live domain. Production redirects should preserve path/query, force HTTPS and send `www` to the apex. Use reviewed Cloudflare redirect rules for host/scheme rather than blanket path rewrites. Keep existing slug URLs and the search-verification file unchanged.
3. Present the exact proposed DNS/nameserver changes and redirect rules to Ryan with the tested preview URL, evidence and rollback commands. Obtain approval before applying them. Nameserver transfer and host cutover may be approved as separate stages.
4. If nameservers move first, import all existing website, email and verification records unchanged so GitHub Pages remains the origin. Check Cloudflare zone activation, mail forwarding, SPF, Google verification and DNSSEC before moving hosting. Confirm proxy/certificate behavior explicitly; do not rely on a default proxy import choice.
5. Deploy the reviewed production package, confirm certificates and attach apex plus www only in the approved cutover. Handle the existing www CNAME explicitly: Cloudflare cannot attach a Worker Custom Domain over an existing CNAME. Keep GitHub Pages enabled and its CNAME file unchanged during the rollback window. Enable the approved HTTPS/www rules after checking their targets.
6. Verify `https://fromastoryteller.com` and `https://www.fromastoryteller.com`: trusted certificates and hostname coverage, www-to-apex and HTTP-to-HTTPS redirects, paths/queries preserved, no loops, all staged content hashes, every published URL, real 404 status, sitemap/canonicals, assets/content types, email forwarding and Google verification. Confirm production has no noindex header. Repeat from another network after DNS caches expire.
7. Wire future main publications to validated Cloudflare builds after approval, with an observable deployment receipt. Studio currently pushes Git; main content publishing must continue to trigger a deployment once Cloudflare is production. The preview workflow deliberately does not provide automatic production delivery.

## Rollback

Before cutover, write down the previous DNS values, GitHub Pages source/HTTPS settings, Cloudflare version ID, source commit and exact tested artifact. Choose who performs rollback and confirm account access. Practice a previous-version rollback on the preview Worker after two preview deployments; this has not yet been done remotely.

If a Cloudflare release breaks after cutover, restore the recorded previous Worker version or redeploy the recorded artifact and recheck content/redirects. Hosting rollback does not roll back Supabase data; avoid destructive database migrations during this hosting task.

If Cloudflare hosting must be abandoned, detach the Worker custom domains/routes and disable rules that intercept the GitHub origin, then restore the four GitHub A records and www CNAME above, initially DNS-only. Confirm GitHub Pages is still serving the recorded commit with trusted custom-domain HTTPS. Nameservers may remain on Cloudflare while serving GitHub; returning to registrar nameservers is an additional deliberate DNS rollback using the complete saved zone. Expect mixed responses during cached TTLs. Test email too. Never delete the old Pages setup until the rollback window is accepted as closed.

Rollback triggers: missing/altered published content, broken assets, certificate errors, redirect loops, persistent 5xx, failed email forwarding or unacceptable core interactions. Preserve reports and deployment logs for diagnosis.

## Evidence and acceptance status

- Existing automated tests: 16 passed.
- References: 432 local references, 44 JavaScript syntax checks and 14 metadata files; zero errors after migration preparation.
- Generator: 14 published items; no semantic published-content changes.
- Public-host comparison: 139/139 files matched status and SHA-256 bytes at `https://fromastoryteller.com`.
- Actual local Wrangler static-assets runtime: 148/148 checks passed, including all 139 public files, two redirect checks and seven missing/private-path checks.
- Remote Cloudflare preview, custom-domain Cloudflare HTTPS, production redirects, browser interaction checks and remote rollback rehearsal: **not yet verified**. No DNS/cutover occurred.

Task completion requires remote deployment evidence, approved production migration, verified domain/HTTPS/assets/redirects, content preservation and a verified rollback path. The planning/preparation portion is done; the migration task is not complete.

## December sequence

Planning target remains 7 December 2026 for the first two contributors. Suggested gates: hosting cutover and rollback by 26 October; Supabase schema/RLS and authenticated story publishing through November; full contributor/admin/privacy/export/deletion/email checks by 30 November; rehearsal with test accounts and final readiness review by 4 December. These are proposed checkpoints, not proof of readiness or a new hours estimate. Track work within the existing 75-hour estimate and preserve Ryan's 2–3 writing hours per week.

## Official references

- [Cloudflare's Workers recommendation](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [HTML routing and redirects](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)
- [Custom Domains, DNS and certificates](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
