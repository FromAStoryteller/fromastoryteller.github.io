# Community V1 end-to-end acceptance — 18 October 2026

Status: in progress. Do not mark complete until the live direct-API run, its exact fixture cleanup and Ryan's real Studio publishing check are recorded.

## Acceptance matrix

| Area | Evidence in this run | Remaining |
| --- | --- | --- |
| Anonymous/viewer/contributor/admin boundaries | Hosted DEV rollback: studio v1/v2, admin-tools and lifecycle suites pass | Fresh HTTP/API run |
| Two authors and ownership | Hosted DEV rollback: private drafts, distinct URLs, cover ownership, public projections and publishing identities pass | Fresh HTTP/API run |
| Optional friend admin | Hosted DEV admin-tools grant, relinquish, independent contributor removal/regrant pass with synthetic accounts | Fresh API grant/relinquish; no real friend is granted access by testing |
| Policy acknowledgements | Hosted DEV community-policy fixtures pass, including stale/missing agreement and no role-inferred acceptance | None for server fixture coverage |
| Publish/unpublish/archive/restore/delete | Hosted DEV lifecycle fixture passes, including public catalogue removal and moderation locks | Browser check and Ryan's real content |
| Images | Hosted DEV image reference/replacement/cleanup ownership fixtures pass; no real bytes targeted | Fresh actual cover upload through HTTP |
| Failed email and retries | Hosted DEV email outbox fixtures pass: retry versions/leases, signatures/events, expiry and cancellation; existing automated provider-failure tests included in full suite | No unsolicited email or test invitation to a friend |
| Mobile and keyboard | New isolated 1280px/390px editor acceptance harness | Run in CI |
| Failed saves, offline, stale edits, reload and session expiry | New browser integration harness plus existing service/recovery tests | Run in CI |
| Ryan writes and publishes real content | Cannot substitute an automated fixture for the writer's test | Ryan performs Studio checklist below |

All eight hosted SQL suites (story-studio, storyteller-studio-v2, story-publishing-lifecycle, image-storage, admin-tools, publishing-identity, community-policies and transactional-email) passed in rolled-back DEV transactions. Preflight found zero existing identities for the exact fixture IDs. Postflight found zero remaining fixture identities and no synthetic policy release; DEV's original NULL policy requirement was preserved. Real accounts, content and Storage bytes were not changed.

## Test-runner corrections

The combined DEV runner now uses current account tests, the existing real-cover Studio API test and a modern Community API test. The old direct Storage upload/approval security suite remains historical source; its expected writes conflict with the current service-controlled upload path and must not be treated as a current release check.

The Community API suite adds direct REST requests and lifecycle checks to the independent admin-role flow. Covers use the real normalized upload endpoint so content exports exercise actual bytes. Fixtures carry the current server policy declaration where required. Credentials remain process-only and failures suppress confidential response bodies.

Admin audit is deliberately immutable through the browser API. The script prints exact synthetic audit/actor/subject IDs for connected-operator verification and cleanup; that cleanup must be recorded before closing acceptance. Never delete real audit entries or use an email wildcard.

## Issues found

The editor's tabs supported arrow navigation but left inactive tabs in the sequential Tab order. They now use one active tab stop, keeping arrow/Home/End navigation and selected-panel semantics.

## Operator HTTP run

Use the existing clean fas-email-check worktree (not the divergent original worktree with unsaved edits). Stop the local dev server with Ctrl+C if that terminal is occupied, then run only the commands below, without copying a PowerShell prompt:

    cd "C:\Users\Ryan\Documents\Codex\2026-10-17\new-chat-2\work\fas-email-check"
    git fetch origin main
    git checkout --detach origin/main
    node scripts/run-fas-dev-tests.mjs

This command's fixed target is FAS DEV. It reads existing private CLI credentials into process memory and does not request secrets in chat. Return the PASS/FAIL summary and synthetic cleanup IDs, never API keys, passwords or private email links. If tracked files are modified, stop before checkout and preserve them; do not reset or discard work.

## Ryan's real Studio check

1. On production, add a story with your own short test text, a description, genre/warnings and a cover you can use. Include two paragraphs and a scene break. Confirm the private preview and 16:9 crop/alt text.
2. Wait for saved status, reload and reopen it from Your work. Confirm your text and details remain.
3. Publish explicitly. Send its public /stories/... URL in chat and check that it appears in Stories and on your storyteller page, including from a signed-out/private window.
4. Edit the title and a sentence, save live changes, and confirm the original public URL still works and the sentence updates.
5. Unpublish and check the public page/listing disappears. Archive, restore to private draft, then republish if you want it kept. Deletion is optional; do not delete content you want to keep.

Record actual outcomes and any confusing controls. The assistant must not click acceptance boxes, write the operator's real test story or publish it on their behalf.
