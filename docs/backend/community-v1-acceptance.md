# Community V1 end-to-end acceptance — 18 October 2026

Status: complete for Community V1. Automated, hosted DEV HTTP and fixture cleanup checks passed; Ryan exercised his real production Studio test story and confirmed permanent deletion. Story-page visual alignment is deferred polish.

## Acceptance matrix

| Area | Evidence in this run | Remaining |
| --- | --- | --- |
| Anonymous/viewer/contributor/admin boundaries | Hosted DEV rollback: studio v1/v2, admin-tools and lifecycle suites pass | Passed: operator HTTP run |
| Two authors and ownership | Hosted DEV rollback: private drafts, distinct URLs, cover ownership, public projections and publishing identities pass | Passed: operator HTTP run |
| Optional friend admin | Hosted DEV admin-tools grant, relinquish, independent contributor removal/regrant pass with synthetic accounts | Passed: synthetic HTTP grant/relinquish; no real friend granted access |
| Policy acknowledgements | Hosted DEV community-policy fixtures pass, including stale/missing agreement and no role-inferred acceptance | None for server fixture coverage |
| Publish/unpublish/archive/restore/delete | Hosted DEV lifecycle fixture passes, including public catalogue removal and moderation locks | Passed: automated lifecycle; Ryan confirmed real test deletion |
| Images | Hosted DEV image reference/replacement/cleanup ownership fixtures pass; no real bytes targeted | Passed: actual normalized cover uploads through HTTP |
| Failed email and retries | Hosted DEV email outbox fixtures pass: retry versions/leases, signatures/events, expiry and cancellation; existing automated provider-failure tests included in full suite | No unsolicited email or test invitation to a friend |
| Mobile and keyboard | Isolated 1280px/390px editor acceptance passed | None for synthetic browser coverage |
| Failed saves, offline, stale edits, reload and session expiry | Browser integration and existing service/recovery tests pass | None for synthetic coverage |
| Ryan writes and publishes real content | Ryan exercised the real Studio test story at /stories/test/, reviewed its displayed page and confirmed permanent deletion | Complete for this version; detailed manual steps not separately attested are distinguished below |

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

## Real Studio check procedure

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

Authenticated DEV HTTP checks and exact audit-fixture cleanup have now passed, as recorded below. Ryan's subsequent real production story test and cleanup are recorded below. No unresolved functional launch blocker was reproduced by the completed checks.

## First operator HTTP run and fixture setup correction

Ryan's fresh authenticated DEV run at main b43ab7e passed the account and Studio suites, including actual normalized cover bytes and verified fixture cleanup. Community stopped before creating any identity because its setup called the public policy requirement RPC with service_role. Hosted DEV grants confirm anon can execute that RPC and service_role cannot. The fixture now reads that public requirement through an anonymous client; production permissions remain unchanged. A read-only DEV check found zero remaining Community fixture accounts after that failure.

The remaining HTTP rerun can use `node scripts/run-fas-dev-tests.mjs --community-only` after fetching and checking out the corrected main in the clean worktree. This keeps the fixed DEV target and process-only credentials. At that correction checkpoint, Community HTTP results, exact audit cleanup and Ryan's real publishing check were pending. The subsequent results below supersede that checkpoint; no pass was inferred from the correction alone.

## Successful operator HTTP acceptance and independent cleanup

On 18 October 2026, Ryan ran the corrected main 88356c0 with `node scripts/run-fas-dev-tests.mjs --community-only`. Community passed roles, two authors, independent friend-admin grant/relinquish, direct REST denials, private invitation acceptance, actual cover bytes, export, lifecycle and revoked sessions. Together with his immediately preceding account and Studio passes, all three authenticated DEV HTTP suites have passed. No test email or real friend role grant was needed.

Independent hosted DEV inspection verified the exact 11 reported admin audit rows (IDs 167–177) against this run's synthetic invitation/account/story subject IDs and synthetic reasons. Account deletion had already nulled audit actors as designed. A transaction guarded by the expected count and exact IDs removed only those verified synthetic audit rows. Postflight returned zero for the exact audit rows, all three fixture users/profiles, both fixture stories, the fixture invitation, associated story asset rows and Storage objects under these fixture owner paths. Real accounts, content and audit records were not targeted.

The fixture-setup correction's CI checks also passed: build/tests/image codecs 117604803816, desktop/mobile browser 117604803654 and production read-only 117604803543. No further API rerun is required unless a new relevant change or failure warrants it. The subsequent real production writer check and its limits are recorded below.

## Real production writer acceptance and closeout

Ryan exercised his own Studio test story (ID e441691b-b74d-42ab-aa3e-0e55beb41911), reviewed its displayed page, and identified its public address as /stories/test/. He reported that the display does not yet match the layout of existing story content pages and explicitly deferred that visual work to a later polish pass. He then followed the archive/permanent-delete workflow and confirmed that it worked.

At Ryan's explicit request and confirmation of the exact address, the connected operator removed only the deleted test story's `test` address reservation. The guarded transaction first confirmed that neither Studio stories nor file-backed content used that slug, required exactly one reservation deletion, and used the existing advisory address lock. Normal published-address reservation behavior was not changed. Production postflight confirmed zero remaining records for the exact test story ID, its story assets, its Storage cover path, and its `test` reservation. No real non-test content was changed.

This closes the required real writing/publishing exercise alongside the passing role, two-author, friend-admin, direct API, mobile/keyboard, failure/recovery, email and lifecycle coverage. Ryan did not separately attest every detailed manual step above (including reload recovery and title-change URL stability); those behaviors retain their recorded automated coverage rather than an invented manual pass. No additional terminal rerun or new production test story is required for this task.

Deferred polish: align Studio-generated public story pages and their preview with the layout/theme of existing story content pages. Compare title/byline/cover placement, manuscript width and spacing, scene breaks/drop cap, and mobile presentation. Preserve the tested permissions, publishing lifecycle and stable URLs while polishing. This is a follow-up item, not a claimed fix in this acceptance task.
