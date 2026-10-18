# Account and contributor policies — 18 October 2026

Release candidate: community-policies-2026-10-18-v1. Predecessor: account-sessions-2026-10-16-v2.

The public Terms include the complete contributor policy. /terms/contributors/ repeats that exact section and points to the immutable Terms snapshot. A single explicit account Terms agreement covers the contributor rules if that person submits work; reader registration by itself grants no submission licence. This avoids a second overlapping contract and keeps existing server-validated version/time/hash records, personal exports and deletion behavior.

The limited non-exclusive licence covers operating the site and public display when the contributor publishes. Ownership stays with the contributor. No exclusivity, unrelated sublicensing, AI-training rights, off-site promotional reuse or automatic monetisation agreement is added. Future paid services need separate terms.

Privacy changes reflect contributor metadata, immediate self-publication, public profiles/social links, processed images, automatic tab recovery, invitations and delivery records. Provider locations and existing privacy rights/contact details remain. The existing personally operated New Zealand identity and email-only contact choice are preserved; no private address or new legal entity is invented.

Signup and existing-account forms distinguish age, Terms and Privacy notice acknowledgement. Invitation acceptance and Studio explain current requirements and direct people to the versioned agreement form. The existing database current-policies gate protects contribution writes even if browser controls are bypassed. Invite acceptance additionally checks that gate server-side before adding a role; a private session-checked definer is exposed through an invoker wrapper. Roles never imply acceptance. Account downloads, correction, deletion and support do not depend on agreeing to later Terms.

Invitation email v2 adds a direct notice of admin-supplied email collection, purpose, recipients and access/correction contact, plus a public Privacy link. Each outbox job persists its renderer version; old jobs remain v1 across retries. Deploy the backwards-compatible Edge renderer before applying the migration, which sets new jobs to v2. It uses no open/click tracking and sends no new messages merely because a policy changed.

## Rollout

1. Validate candidate snapshots, generated SQL, acknowledgement flows, lifecycle rights and immutable history in CI.
2. Deploy backwards-compatible invitation renderer to DEV, then apply migration and verify in a rolled-back fixture. Never accept Terms for an actual person.
3. Publish the exact frozen pages and verify their public bytes/hashes. Keep the previous server requirement until public verification.
4. Register the new release using the guarded predecessor transition. Publish the registry's active version in coordination with the requirement; mismatches must fail closed. Preserve original agreements; require explicit new ones from contributors.
5. Review live public routes and signup configuration, and record deployment evidence here. A real operator still chooses whether to agree through the account UI.

## Sources reviewed

- NZ Privacy Commissioner: privacy statements (including indirect collection), https://www.privacy.org.nz/resources-and-learning/knowledge-base/view/312/
- IPP3A guidance (effective 1 May 2026), https://www.privacy.org.nz/resources-and-learning/a-z-topics/ipp3a/
- IPONZ copyright licensing, https://www.iponz.govt.nz/get-ip/copyright/licensing-copyright/
- Supabase function security, https://supabase.com/docs/guides/database/functions

These are implementation and source-review notes, not a legal certification or a claim of universal compliance. Previously approved operator/contact choices remain as documented in policy-versioning-review.md.

## Validation and staged deployment

174 automated tests pass, including an actual PostgreSQL rehearsal of missing/unchecked/stale acknowledgement, invitation acceptance after explicit agreement, isolation and role non-inference. Existing deletion/export/agreement-history suites also pass. Edge codecs, references, content generation, preview build and Worker bundle pass. The synthetic browser flow passes at 1280px and 390px with no horizontal overflow or page exceptions.

DEV: Edge invitation worker version 5, followed by source migration 20261018053532_community_policies.sql (hosted history 20261018053933). The hosted rollback fixture passed; both exact fixture identities and the synthetic policy release are absent afterwards, and DEV's pre-existing NULL requirement is preserved. New email jobs default to renderer v2; existing jobs retain v1. No real email, account agreement or content was created by this validation. The public invitation wrapper is now invoker; its private definer checks the live session and current agreement.

Security review: private tables intentionally have RLS without browser table policies. The new private invitation function has explicit grants and an empty search path; the public wrapper is not a definer. Previously documented public projection/self-service definer advisories and DEV's disabled leaked-password protection remain outside this change; no new public definer endpoint was introduced.

A later policy transition need not disable Auth signup: the release singleton is locked, Auth validates exact version/hash metadata again while recording agreement, and stale requests fail closed. The bootstrap release preparation keeps its original signup-off instruction. There can be a short registration retry interval while the server requirement and deployed runtime registry change; no stale acceptance is silently upgraded.

## Public snapshot publication

PR #47 merged as 1295d8c215239ad94779039ca89e3cbc0af76b9d. Public verification job 117598393539 passed: both new immutable snapshot bodies exactly match their SHA-256 records; Terms, Privacy, contributor policy and agreement routes are served; the previous account runtime and database requirement still match while activation is prepared. No policy history was rewritten. The production invitation worker is version 4 with the identical verified deployment digest as DEV; it supports both persisted renderer versions before database migration.

Activation changes the active registry to the published community release. The guarded transition names the exact predecessor and verifies both old and new document hashes. It inserts no acceptance for a real account. Existing contributors will see the review step before further work. Public page access and account export/removal are unaffected.
