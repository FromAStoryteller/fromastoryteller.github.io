# Account lifecycle decisions — 15 October 2026

Ryan confirmed the site is operated personally from New Zealand.
Public operator/contact: Ryan Fearon, fromastoryteller@gmail.com.
Ryan selected a 30-day maximum for deleted-account data in backups and will remove
or replace old manual archives to honour that schedule.
The minimum age must be reviewed against the intended audience and applicable law;
no arbitrary legal minimum has been asserted in registration. The NZ Online Safety
minimum-age material currently found is a bill, not a universal account rule.
Ryan wants teenagers and adults and delegated the product setting. Proposed launch
policy: accounts for ages 16+, public published reading without an account. This is
a site-policy recommendation, not a statement that NZ law universally requires 16.
Review international/child-directed-service obligations and enforce the final policy
server-side before public registration. Public registration remains disabled.

Ryan selected removal of account and content on deletion. For accounts with
contributor access, offer an export of **all their content** before deletion and
require explicit deletion confirmation. Do not silently retain published work
under anonymous attribution. Ordinary viewers must not gain contributor privileges.

Implementation requirements:

- Reauthenticate for deletion; never trust a supplied account UUID or user metadata.
- Offer a complete export of owned drafts, published work and uploaded originals,
  including games once the game ownership/data model exists. A profile-only export
  must never be labelled a complete contributor content export.
- Show exactly what will be removed and obtain a second explicit confirmation.
- Block new publication/uploads during deletion; safely coordinate database,
  Storage and caches. Recheck ownership on the server and ensure retries are safe.
- Revoke sessions, remove owned bytes/content and dependent moderation rows in the
  correct order, and finally remove the Auth identity. Account deletion alone does
  not remove Storage files or immediately invalidate an issued access JWT.
- Never permit self-service deletion of the last administrator; staff accounts
  require a separate reviewed path.
- Explain backup retention, including when deleted data ages out of backups, in
  the eventual Privacy policy. Restore procedures must not resurrect deletions.
- Test two different users, published/draft content, files, expired sessions,
  interrupted deletion and export completeness before enabling contributor deletion.

Existing schema deliberately has no browser delete grants and stories reference
their author without cascading deletion. Preserve those protections. Lifecycle
deletion needs a trusted server workflow; do not add a broad client DELETE policy
or perform a bare Auth-user deletion for contributors.

Existing static games/stories are not yet assigned to a chosen final account.
No transfer to test identities is authorized. Play My Path remains separate.

Primary sources for age review:
[NZ Parliament bill](https://bills.parliament.nz/v/6/ba928141-d337-493a-01d5-08df0193ecfa),
[NZ Privacy Commissioner children’s privacy](https://www.privacy.org.nz/resources-and-learning/a-z-topics/protecting-children-and-young-peoples-privacy/),
[FTC COPPA FAQ, including overseas sites](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
