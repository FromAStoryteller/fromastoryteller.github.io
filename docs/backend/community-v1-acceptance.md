# Community V1 end-to-end acceptance — 18 October 2026

Status: in progress. Do not mark complete until the live direct-API run, its exact fixture cleanup and Ryan's real Studio publishing check are recorded.

## Acceptance matrix

| Area | Evidence in this run | Remaining |
| --- | --- | --- |
| Anonymous/viewer/contributor/admin boundaries | Hosted DEV rollback: studio v1/v2, admin-tools and lifecycle suites pass | Fresh HTTP/API run |
| Two authors and ownership | Hosted DEV rollback: private drafts, distinct URLs, cover ownership, public projections and publishing identities pass | Fresh HTTP/API run |
| Optional friend admin | Hosted DEV admin-tools grant, relinquish, independent contributor removal/regrant pass with synthetic accounts | Fresh API grant/relinquish; no real friend is granted access by testing |
| Policy acknowledgements | Hosted DEV community-policy fixtures pass, including stale/missing agreement and no role-inferred acceptance | None for server fixture coverage |
| Publish/unpublish/archive/restore/delete | Hosted DEV lifecycle fixture passes, including public catalogue removal and moderation locks | Browser passed; Ryan's real content remains |
| Images | Hosted DEV image reference/replacement/cleanup ownership fixtures pass; no real bytes targeted | Fresh actual cover upload through HTTP |
| Failed email and retries | Hosted DEV email outbox fixtures pass: retry versions/leases, signatures/events, expiry and cancellation; existing automated provider-failure tests included in full suite | No unsolicited email or test invitation to a friend |
| Mobile and keyboard | Isolated 1280px/390px editor acceptance passed | None for synthetic browser coverage |
| Failed saves, offline, stale edits, reload and session expiry | Browser integration and existing service/recovery tests pass | None for synthetic coverage |
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

## CI and production read-only results

On 18 October 2026, browser job 117603389305 passed at 1280px and 390px. It exercised essential-only storage via keyboard, roving editor tabs, private preview and focus return, failed save with preserved text, reload recovery, actual browser offline mode/retry, session-expiry lock/re-authentication, publishing, unpublishing, archive/restore, conflicting-edit copying, delete cancellation and final confirmation. The same run checks admin failed-email input retention, delivery refresh, retry without duplicate jobs, correct provider-accepted wording and disabled-delivery manual fallback. These browser services are fictional; they do not substitute for real HTTP permission checks.

Production read-only job 117603389192 passed. It checks current server/runtime policy agreement and exact public document hashes, anonymous raw REST denial/empty results for private profiles/roles/invitations/drafts, denial of admin and personal-agreement RPCs, unsigned/unauthenticated email endpoint rejection, public routes and catalogue availability. It creates no identity, story, invitation, outbox job or acceptance.

Build job 117603389246 passed all 174 automated tests, actual Edge image codecs, references/syntax, generated indexes/Worker marker, Cloudflare preview build and Worker bundle. One repeated run exposed a wall-clock boundary flake in the email signature test: a nominally 301-second future stamp could enter the valid 300-second window during execution. The test now injects a fixed clock and checks both inclusive five-minute boundaries and one-millisecond rejection outside them. Production HMAC behavior was not changed or relaxed.

The apparent publishing stall during harness development was a selector reading an unrelated page state attribute; the actual UI had already confirmed publication. The harness now checks the Studio badge specifically. It also uses the actual Essential only control before testing the footer controls, rather than clicking through the storage banner.

Authenticated DEV HTTP checks and exact audit-fixture cleanup remain pending the operator command above. Ryan's real story and public URL remain pending. No unresolved application blocker was reproduced by the checks completed so far; these pending acceptance steps must not be reported as passed.

## First operator HTTP run and fixture setup correction

Ryan's fresh authenticated DEV run at main b43ab7e passed the account and Studio suites, including actual normalized cover bytes and verified fixture cleanup. Community stopped before creating any identity because its setup called the public policy requirement RPC with service_role. Hosted DEV grants confirm anon can execute that RPC and service_role cannot. The fixture now reads that public requirement through an anonymous client; production permissions remain unchanged. A read-only DEV check found zero remaining Community fixture accounts after that failure.

The remaining HTTP rerun can use `node scripts/run-fas-dev-tests.mjs --community-only` after fetching and checking out the corrected main in the clean worktree. This keeps the fixed DEV target and process-only credentials. Community HTTP results, exact audit cleanup and Ryan's real publishing checklist are still pending; no fresh pass is inferred from this fixture correction.
