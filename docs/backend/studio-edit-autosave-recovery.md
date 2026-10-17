# Studio edit, autosave and preview recovery

Task: **FAS | FAS Community V1 | Implement edit, autosave and preview**.
Status: implementation and automated verification in progress; production has not yet received this change.

## Save and reload behavior

- Create/edit private Community drafts using the existing writer and preview. Draft autosave waits 1.8 seconds after typing; published/scheduled work still requires explicit saving.
- Saving announcements distinguish unsaved, saving, failed and saved states. Typing while a save is in flight is not marked saved by the older response. An explicit queued Save/Ctrl+S saves the newest text after the earlier successful request.
- Failed saves keep the editor and stop silent automatic retries until the writer explicitly retries. Offline Save provides a recovery/download action. Current-version checks continue to prevent stale overwrites.
- A saved content UUID in the Studio URL reopens the selected work after reload through the existing owner-checked service. The URL contains no manuscript, title, email or credentials.
- Input-method composition is allowed to finish before an automatic save is scheduled. Private preview renders the newest editor values through the shared manuscript renderer.
- Never-published draft deletion still requires confirmation and clears its recovery copy. Previously published addresses/history remain protected.

## Optional tab copy and recovery files

Server autosave does not depend on browser recovery. **Tab recovery is off by default** and has its own explicit checkbox and storage explanation. It is not enabled by accepting optional appearance/game storage choices.

When enabled, the current unsaved copy is written to account-scoped sessionStorage in the current tab. It contains bounded title/manuscript/metadata and a public profile ID/source-version reference, never auth tokens, passwords, uploaded bytes or secret keys. It does not use localStorage. Copies are offered for 24 hours; expired or malformed copies are removed when checked. Browser tab restoration can retain sessionStorage, so tab closing is not promised as guaranteed erasure. Successful saves, explicit discard and signing out through this Studio remove the checkpoint. Switching accounts clears recovery namespaces for other accounts. Blocked/quota storage produces an honest failure message and does not claim a new copy was saved.

A private recovery file preserves valid structured text and metadata and can be explicitly imported by the owning account. It is limited to 1 MiB. It remains importable after the temporary tab-copy age limit. It is a user-downloaded private file, not an uploaded image or a server backup. Treat its contents as untrusted and render only validated text/document blocks.

Recovery requires an explicit action:
- Resume in place only if the owner-read saved row is still the same version of an unscheduled private draft.
- Otherwise recover as a new private draft, retaining the existing/newer original. A copy clears cover selection and scheduling; it cannot publish or silently update live content.
- Restored writing waits for explicit Save before autosave resumes.
- Download or discard the recovery copy without changing server content.

Invalid editing details must not prevent recovering words. A safe text-only fallback is retained if structured capture is unavailable. Such a fallback is identified and is not allowed to resume over a richer saved draft. Text exceeding editor/recovery-file bounds can still be downloaded as text while the tab remains open; an unsupported copy must not be falsely reported as persisted or rendered into a broken editor.

## Expired sessions and account changes

Session expiry stops autosave, clears the editor/private image UI and holds the unsaved snapshot behind a recovery screen. That screen does not reveal the title, manuscript or private account email.

The existing password sign-in controller is reused in the same tab, preserving the current sign-in persistence mode. After sign-in (or Check my sign-in), loadProfileAccount independently verifies the actual account:
- Matching active contributor: offer recovery choices, with no automatic save/publication.
- Matching active account that lost contributor access: allow downloading its own unsaved writing; do not recreate a writer or grant publishing rights.
- Different/closing account: discard the old recovery and do not reveal it.

A session-end event alone does not identify whether expiry or a sign-out elsewhere caused it. Such events lock recovery rather than granting anonymous download access. Explicit Studio sign-out and detected account switches discard it. With tab recovery disabled, unsaved expiry recovery lasts only while this page stays open; the screen tells the writer to keep the tab open. A beforeunload warning protects that held copy.

## Verification

Unit tests cover safe metadata/document roundtrips, untitled writing, malformed/other-account files, resume version/state checks, optional storage, expiration, quota/blocked storage, namespace cleanup and repeated-genre recovery.

The fictional Chromium rehearsal covers creation/autosave/server reload, newest-word preview, failed saves without silent retries, optional tab reload recovery, explicit resumed save, typing during a delayed save with Ctrl+S, stale edits recovered into a new private draft, mobile overflow, same-account expiry recovery, different-account denial, offline export/import and browser-storage errors. The fixtures are isolated browser contexts and do not use real accounts or content.

Existing PostgreSQL/service tests continue to check ownership, stale versions, publication, draft deletion and session/access safeguards. No database migration, Auth provider configuration, published policy-history rewrite, analytics or ad setup belongs to this change.

## Release

After checks pass, merge the frontend release with an expected-head lease, wait for the production deployment and compare the served Studio modules/styles to the reviewed sources. Verify the public Studio shell without signing in or editing the operator's content. Record production evidence here before marking complete.

The frozen historical policy documents remain unchanged. The feature's optional tab-copy behavior is disclosed at the control; no manuscript recovery is silently enabled.
