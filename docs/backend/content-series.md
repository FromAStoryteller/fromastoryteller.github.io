# Series, collections and published navigation

Open **Series & collection** in Studio for a saved draft or an existing piece.
**Part of a series** enables its name and **Comes after** choice. Choose an existing series or use Create a new series. Collection/world has
its own existing/new choice. Comes after groups matching series work separately
from unassigned work, showing drafts (latest updated first), scheduled pieces
(nearest first, local time and timezone), then latest published releases. A collection is an optional shared
world or grouping; different series can belong to one collection. Collection
membership also works without a series. Save these details before publishing.

Choosing an older, unassigned predecessor enrols it automatically. Each piece has
one immediate successor. Loops, cross-contributor personal links, conflicting
successors and stale updates are rejected. To change the series of a piece which
already has a successor, edit that following link first. Personal works stay
within their contributor/publishing identity. Shared FAS relationships use the
existing independent administrator and contributor checks.

Public collection pages contain published work only. Previous/next links require
the immediate piece to pass existing publication/account/moderation guards. A
draft, schedule, archive or unavailable account never reveals a hidden part’s
title, address or ID. Links resolve on page load; manuscript/player files need no
manual edits. Legacy file-backed games/tools have the editor in their details.

The additive `content_series_and_collections` migration creates a private RLS
table and guarded RPCs, changing no existing manuscripts, ownership or addresses.
Relationship versions are independent of manuscript timestamps. Account download
v6 includes the owner’s settings. Deletion removes membership and references to
permanently deleted content. Content revision history still covers manuscripts
and player files, not these separately saved relationships. Backups must include
the new private table.

Navigation uses published file/community catalogues and generated file visibility
as fallback. Studio publication/archive actions refresh it. Blog, Videos and
Gallery remain hidden while empty. Gallery now has a category page and conditional
navigation; a contributor Gallery uploader is not enabled by this change.

Verification includes real PostgreSQL graph/privacy/permission tests, hosted DEV
transactional rollback tests, and desktop/mobile light/dark browser checks. No
fictional content is inserted into production for verification.

Applied migration mapping: repository `20261021171308`, hosted DEV
`20261021172608`, production `20261021173919` (same additive SQL). Hosted DEV
transactional checks left zero fictional users and zero relationship records.
Production read-only checks confirmed anonymous editor/write denial, no browser
table grants and empty relationships for existing unassigned pieces.
