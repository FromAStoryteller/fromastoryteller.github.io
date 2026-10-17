# Studio draft deletion — 18 October 2026

Studio now offers Delete draft beside Download text for saved, never-published, unscheduled drafts. Cancel a schedule before deleting. Published or previously published content is excluded to preserve permanent addresses and reporting history.

The modal names the draft, explains irreversible deletion, offers Download text and defaults focus to Keep draft. Confirmation actions wrap on narrow screens. Autosave pauses while the modal is open; cancellation resumes pending draft autosave. A successful deletion clears editor state, returns focus to Your work and announces Draft deleted. Deleted IDs are filtered from pending library responses. Failures keep the draft and stale conflicts require reopening.

The service rechecks active contributor identity, then deletes with author ID, content ID, updated_at, draft status, unlocked address and null publication/schedule filters. It requires a matching returned ID before reporting success. Existing owner RLS and cascades apply; no new production migration or permission change is needed. Cover metadata cascades; previously uploaded Storage bytes are not physically purged by this client operation and become inaccessible through the removed story. Storage-byte cleanup remains separate from this change.

Validation: 135 local tests and reference/syntax checks passed before the session's local runner became unavailable. The fictional desktop browser preview verified cancel, error retention, confirmation, successful return to the library and pending-autosave suppression. Follow-up CI verifies the final patch, narrow-screen CSS and the added PostgreSQL selected-cover cascade/ownership/stale-version fixture. No real production draft is deleted during verification.
