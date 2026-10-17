# FAS Community V1 backend

Status: accounts, contributor profiles and **Storyteller Studio V1 are deployed**.
Studio V1 was accepted on 18 October 2026. Start with [current operations](operations.md),
[Studio acceptance and follow-ups](studio-v1-handover.md) and
[backup/restore](backup-restore.md). The original foundation setup is in [setup.md](setup.md).

## Current behavior

- Viewer registration is open in the deliberate production account configuration.
  Contributor privileges are invitation-only; an Auth account alone grants none.
- Contributor and admin permissions are separate. Contributors publish and update
  their own work without administrator approval. Admin moderation can unpublish/lock
  content; it does not grant an ordinary contributor ownership of someone else's work.
- Community stories/blog posts use the Studio manuscript editor, private drafts,
  catalog metadata, verified covers and private scheduling. See [Studio](story-studio.md).
- Existing file-backed stories, games and tools retain their source-file workflow
  and canonical URLs. Their owner can manage publishing attribution and insights
  through the separate selected-work view.
- Private account ownership and public personal/FAS publishing identity are distinct.
  Only the explicitly granted account can select FAS; tools always use the FAS byline.
- Public profiles/readers receive explicit safe projections. Raw profiles, Auth
  identifiers, email, private asset paths and publishing capabilities are not a
  public directory.
- Draft deletion is limited to saved, never-published, unscheduled drafts.
  Previously published addresses/history are retained. See [draft deletion](studio-draft-deletion-2026-10-18.md).

The earlier submitted/rejected review and staff-approved-image workflows belong to
the initial schema history. They are not the current contributor publishing path.
Legacy columns/functions remain only where required for compatibility; do not use
old setup examples to reintroduce approval.

## Images and security

The image bucket is private. Studio uploads are authenticated, decoded, cropped
and re-encoded server-side to verified 1600×900 JPEGs. Cover selection requires
an owned verified 16:9 image with alternative text, not human clearance.
A selected cover becomes publicly readable only with eligible published content.
Unpublished and unselected alternatives remain private.

Public/private image delivery uses the checked Edge image endpoint; direct Storage
reads/signing remain blocked. RLS, owner/version checks, current session/account
checks and server-side publishing grants enforce authorization. Browser code renders
safe structured manuscript blocks and text; user-editable JWT metadata is not used
to grant contributor or FAS-publishing access.

Physical cleanup of orphaned uploaded bytes and expanded static-source exports are
follow-up capabilities, not effects promised by deleting a draft.

## Environment separation and secrets

FAS uses its own local stack and separate hosted DEV/PROD projects. Never reuse
another application's project, identity store, key, bucket or backup.
Local API/DB/Studio/Mailpit ports remain 55321/55322/55323/55324.
Git branches do not change the CLI's linked database.

Production public account configuration is generated deliberately for the exact
site origin. Only publishable/legacy anon keys belong in browser configuration.
Secret/service_role keys, database passwords, access tokens and backup contents
stay out of Git, frontend bundles and chat.

## Current schema and releases

The original six tables are the foundation, not a complete inventory of today's
schema. Later reviewed migrations add account/policy controls, public profile IDs,
separate contributor/admin roles, Studio catalogs and verified assets, reporting
foundations, publishing identities and private file-content ownership.

See:
- [Database/storage security](security-completion.md)
- [Contributor permissions](contributor-permissions.md)
- [Separate admin tools](separate-admin-tools.md)
- [Studio production rollout](studio-production-rollout-2026-10-17.md)
- [Publishing identity rollout and mappings](publishing-identities-release-2026-10-17.md)

Applied migration files and installed history are immutable. Repository, DEV and
production timestamps can differ; preserve the recorded mappings rather than
blindly pushing or repairing history. Test new migrations locally/DEV, make the
required production backup, then apply only the reviewed changes to the explicit
target. Never reset production as a deployment or rehearsal.

## Remaining work

Studio V1 is complete. The [follow-up backlog](studio-v1-handover.md#follow-up-backlog)
covers usability/function polish, source-content editing/type expansion, orphan
cleanup, reporting/monetization and a full isolated hosted restore rehearsal.
No analytics provider, ad delivery, earnings or payouts are active.
