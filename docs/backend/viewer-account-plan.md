# Viewer accounts: small review batches

Ryan's working preference: create skeletons using the existing HTML structure,
shared site shell and theme tokens, show each batch in the browser, then refine
the personal design together. Content artwork uses 16:9. Sign-in and sign-up use
centred forms without decorative artwork or introductory side panels for now.
Keep Play My Path separate.

1. Sign-in page skeleton: local design preview, disabled controls, no Auth changes.
2. Review the visual direction together; extend it to sign-up and recovery skeletons.
3. Review Privacy and Terms against actual features, operator details, audience and
   jurisdiction. Prepare accurate drafts for Ryan to review; resolve legal questions
   before opening registration. Do not describe draft policies as legal approval.
4. Implement verification, sign-in/out, session refresh/expiry and recovery in FAS
   development, with success/error states and browser/email tests.
5. Agree account settings/deletion behavior and implement the account lifecycle.
6. Rename/rework the site About navigation and its icon separately from Ryan's
   personal profile, retaining the existing route unless a redirect is needed.
7. Once Ryan chooses the final account and username, plan explicit attribution of
   existing stories/games to its stable account UUID. Preserve content, URLs and
   backups; do not auto-import or assign content to temporary accounts. A username
   is a display/search identifier, not the immutable ownership key.
8. Add profile search only for intentionally public profile information. Protect
   emails, account details, private profiles and drafts; review search indexing rules.
9. Perform final end-to-end checks, legal review and deliberate production signup
   enablement. Signup alone must never grant contributor privileges.

The sign-in layout was reviewed and simplified to a centred form. The next small
batch adds the matching sign-up skeleton and navigation between the two previews.
Forms remain disabled; public registration and live-site changes are not enabled.
Recovery is the next skeleton after Ryan reviews this batch.

This sequence records the requested work; only the first two small batches have started.
Later batches may change after Ryan reviews each skeleton.
