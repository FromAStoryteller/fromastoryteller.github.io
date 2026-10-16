# Policy review and preserved versions — 15 October 2026

## Current batch

16 October update: the prepared launch candidate is
`account-launch-2026-10-16-v1`, with two checksummed copies under policy-history.
Ryan requested **From A Storyteller** as the public-facing operator name instead
of his personal name. The candidate, current review hub, registry operator label
and signup collection notice now use that name and describe the site as personally
operated in New Zealand. This does not imply incorporation or create a separate
legal entity. Previously acknowledged notices and their original checksums remain
unchanged. The change was made during candidate preparation, before its first
commit or any agreement to it; both candidate checksums were recalculated.

The candidate replaces DEV instructions with reader-facing account practices and
explicit launch applicability. Its status is `publication-candidate`, and
activePublishedVersion remains NULL. Even selecting it as active cannot satisfy
the production build's published-status requirement. No server release, agreement,
Auth setting, production page or service was changed. Wording review is distinct
from approval to publish or activate live registration.

The current review hub points to the candidate. The v2 review pages below remain
earlier preparation material. At rollout, copy the approved content to the live
Privacy/Terms routes as well as retaining the exact immutable version, verify the
server release/version/hash values, and preserve old declaration records. Do not
silently change draft acknowledgements or treat an operator wording review as a
registrant's agreement.

Update: Ryan reviewed the wording and asked work to continue. Prospective server
agreement support and contribution gates are now installed but inactive in local
FAS and DEV; see [implementation/evidence](published-policy-agreements.md).
The original review-stage plan below is historical preparation, not current
implementation status. No published agreement has been activated.

The operator review starts at `/account/policy-review/`, with separate `/account/privacy-review/` and `/account/terms-review/` pages. They use the existing theme and carry review version `account-review-2026-10-15-v2`. They remain noindex and outside site search/sitemaps. The proposed signup controls are disabled, collect nothing and do not accept a contract. Live registration is unchanged.

Ryan explicitly chose launch without a postal address. The review uses Ryan Fearon, New Zealand and fromastoryteller@gmail.com, with email contact. No home-address field, postal placeholder or invented service address was added. No postal-address purchase or appointment is required by this implementation.

NZ OPC IPP3 guidance refers to agency name/address. Its related IPP3A guidance expressly permits an equivalent such as email or website for indirect-collection notices. This supports documenting the practical email contact approach, but is not a blanket legal ruling about every direct collection, overseas audience or future commercial service. Do not claim a universal postal-address requirement, or certify universal compliance from the related guidance. If the actual service needs further advice, assess that question with OPC/qualified advice; do not automatically publish private details. No enquiry was sent on Ryan's behalf.

Sources checked: [IPP3 collection notice](https://www.privacy.org.nz/privacy-principles/3/), [IPP3A notification guidance](https://www.privacy.org.nz/resources-and-learning/a-z-topics/ipp3a/), [access timeframes](https://www.privacy.org.nz/your-rights/ask-for-your-information/), [retention](https://www.privacy.org.nz/privacy-principles/9/), [overseas processing](https://www.privacy.org.nz/privacy-principles/12/), [consumer rights](https://www.consumerprotection.govt.nz/general-help/consumer-laws/consumer-guarantees-act).

## Preserve what testers actually saw

Existing DEV records refer to `local-preview-2026-10-15-v1`. Both original pages are copied into `account/policy-history/local-preview-2026-10-15-v1/`. The catalog in `account/policy-versions.json` records UTF-8/LF-normalised SHA-256 values for those documents and the original linked policy bodies. Tests fail if either is changed. Outer site-shell updates on the original pages do not change the acknowledged policy body. The preserved archive is kept unchanged. Checksums detect accidental changes; this is repository-controlled history, not a cryptographic signature or tamperproof external ledger.

Current signup links and the Auth hook remain on the original draft. New review wording cannot silently replace the document associated with an old acknowledgement. Account rows, roles, stored declarations, Auth configuration and production were not changed in this batch.

`npm run check:account-policies` verifies preservation. Adding `-- --for-launch` also checks for approved published snapshots; it deliberately fails now. Both the old test draft and new review draft are rejected as a live agreement. This is an operator readiness check, not server enforcement or an Auth configuration switch.

## Final agreement implementation after wording review

1. Review the actual provider/retention arrangements and final policy text; preserve published snapshots under a new version with content hashes and publication date. Do not overwrite the test or review history.
2. Add a separate server-validated published agreement mode in a new migration. Validate exact current policy versions and true booleans, keep original test declarations unchanged, and never infer agreement from metadata edits, a website visit or an old account.
3. Present unchecked age eligibility, Terms agreement and Privacy-notice acknowledgement separately. Optional storage preferences stay independent. Do not call a Privacy notice acknowledgement consent to all processing.
4. Record the authenticated/created identity, release IDs/hashes, kind and server time in a private, minimally retained table. Browser callers must not choose another person's ID or rewrite timestamps/old records. Include self-only records in personal exports and account deletion. Do not add IP addresses, birth dates or identity documents just to prove agreement.
5. Existing DEV/legacy accounts need a fresh, explicit process before using any feature that requires the published agreement. Preserve access to privacy requests, exports and deletion; do not hold those rights hostage to new Terms.
6. Test stale/missing/false/forged claims, another identity, editable metadata, immutable history, export/deletion and re-agreement. Deploy to DEV before deliberate production enablement.

This batch prepares and verifies the review/history foundation. It does not implement or deploy the future published-agreement migration, change the existing signup acknowledgement or claim that the entire policy/production launch step is complete. Contributor licensing, international/teen suitability, provider contracts and production operations still require review against the actual service. The 16+ rule remains a proposed product rule, not a universal NZ statutory minimum. Future saves/multiplayer remain planning only, with no speculative collection.
