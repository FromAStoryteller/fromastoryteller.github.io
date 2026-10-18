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
