# Storyteller Studio V1 — acceptance and handover

Status: **complete for V1**. On 18 October 2026, Ryan accepted the current version and requested that remaining usability/function refinements be handled as follow-up work. This closes the original Story Studio task, including the later agreed Storyteller Studio changes.

## Acceptance

| Requirement | Released behavior | Evidence |
| --- | --- | --- |
| Title and body editing | Safe manuscript blocks; shared editor/preview/reader styles; one opening drop cap; standard paragraphs and selectable scene breaks | Formatting tests and browser rehearsal |
| Metadata | Description, language, 1–3 catalog genres/subgenres, suggested/custom tags, reviewed warning dropdown, type-specific requirements and version flags | Service/PostgreSQL/hosted DEV checks |
| Required cover | Owned verified 16:9 cover with alt text; accessible crop repositioning; automatic image normalization without admin approval | Crop/codec/API/ownership tests |
| Clear private draft state | Library first; draft/scheduled/published/moderation states; autosave feedback; stale-save protection; text download; confirmed draft deletion | Service/database tests and fictional browser rehearsal |
| Publishing and URLs | Contributor self-publication; private scheduling; live edits; unique title-derived URLs that become permanent at first publication | Hosted DEV API, SQL and Worker checks |
| Desktop/mobile access | Labelled native controls, keyboard tabs/focus, save announcements, consistent themed controls and aligned draft actions | Chromium at desktop, tablet and phone widths |
| Other content types stay out of the manuscript editor | Stories and blog posts enabled by later agreement; game/tool/video creation disabled; existing source-file work has separate publishing settings | Type catalog, UI rehearsal and route tests |
| Personal/FAS ownership and bylines | Existing ten stories/two games assigned to the operator; personal default; authorized FAS choice; tools fixed to FAS; stable IDs and URLs | Exact owner claim, public projections and all 14 live pages |

The final runtime release passed **140 tests**, reference/index checks and Worker bundling. Hosted DEV fixtures passed and rolled back. Production read-only verification checked all 14 file-backed content pages, both publishing profiles and deployed Studio sources. The user's private draft was not published, edited or deleted for acceptance.

## Current operating limits

- Existing repository stories, games and tools retain source-file body/code editing. Their Studio entry manages publishing identity and insights.
- Insights show a disconnected state until a verified reporting source is connected. No visitor tracking, ads, earnings or payouts were activated.
- Draft deletion removes saved draft/cover records; physical orphaned upload cleanup is a separate maintenance capability.
- Backup encryption/integrity and off-site sync were confirmed. A complete hosted restore rehearsal remains separate.
- No claim is made that every future usability refinement is complete. The remaining items below are follow-up work rather than blockers for the accepted V1.

## Follow-up backlog

These are proposed workstreams, not automatically started features or verified defect reports. Retain the current theme, contributor ownership safeguards and stable addresses throughout.

| Follow-up | Useful next outcome | Boundary |
| --- | --- | --- |
| Studio usability and function polish | Review library → selected-work → editing/insights navigation, action hierarchy, validation/error recovery and keyboard/mobile behavior; record concrete issues and prioritize them before changes | Start with a focused audit of the accepted version; preserve save/conflict behavior |
| Existing-content editing and future types | Decide how legacy stories become editable without losing their formatting/URLs; keep source metadata synchronized; define separate game/tool/video editors and export coverage | Do not open a manuscript editor for unsupported types or silently import source files |
| Private image lifecycle cleanup | Design a reference-aware, ownership-checked orphan cleanup with retention, dry-run inventory and rollback/audit evidence | Do not delete bytes that are selected, referenced, in use or needed by the backup/restore process |
| Reporting and monetization | Choose a verified analytics/report import path, then separately define ads, consent, revenue rules and payments | Stable page/beneficiary IDs already exist; no new tracking or money flow is implied by this handover |
| Hosted restore rehearsal | Restore Auth/application data, seeded records, image bytes, ownership/bylines and the newest deletion ledger into an isolated disposable FAS project; verify permissions and measure recovery time | Never restore over production or send mail from restored accounts |

## Operator handover

- [Current operations](operations.md) identifies the deployed state and manual backup routine.
- [Studio behavior](story-studio.md) covers the writer, metadata, publishing and reporting foundation.
- [Production rollout](studio-production-rollout-2026-10-17.md), [draft deletion](studio-draft-deletion-2026-10-18.md) and [publishing names](publishing-identities-release-2026-10-17.md) retain the detailed release evidence.
- Run the existing local/DEV checks before functional changes. Apply database changes through new reviewed migrations after the required fresh production backup.
- Keep applied migration files/history immutable and preserve the documented repository/DEV/production mappings.
- The separately requested **Implement edit, autosave and preview** task is released; see [autosave and recovery evidence](studio-edit-autosave-recovery.md). It adds optional tab recovery, portable copies and locked same-account recovery without reopening the original V1 acceptance. The broader usability/function audit above remains follow-up work.
