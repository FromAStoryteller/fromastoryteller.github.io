# FAS Community V1 backend

Start with [setup.md](setup.md), then [backup-restore.md](backup-restore.md).
For the additive security changes and direct API checks, follow [security.md](security.md).
This is the database foundation, not a deployed community interface. The current
website still reads static files. Nothing here imports, edits or republishes the
existing stories. Online games and optional community features remain later scope.

Local, hosted dev and hosted prod setup is complete as of 14 October 2026.
See [operations.md](operations.md) for verified checks and the current manual
backup routine. This status does not mean the community UI is ready to launch.

## Decisions and boundaries

The intended account model is open viewer registration with invitation-only
contributors. A viewer has an Auth account/profile and no contributor role;
`member` is the current database name for a contributor. Public signup is disabled
during foundation setup and must be enabled deliberately when the account flows
are built and tested. These implemented choices require security review before
launch: member/moderator/admin roles, moderation before publication, plain-text
story bodies, private image storage and archival rather than client deletion.
An earlier hosting plan proposed immediate contributor publication; resolve that
workflow difference before changing permissions. FAS has its own local project
and separate hosted dev/prod projects.
Never reuse a PMP project, database, key, user identity store, bucket or backup.

The browser will use Supabase Auth, the Data API with a publishable key, and Storage.
Row-level security (RLS) means the database checks each user's permission for every
row. Browser code must still render user text safely (textContent, or an approved
sanitizer if rich text is added). The backend is not an HTML sanitizer.

Auth manages identities, email and passwords in `auth.users`; never make a separate
password table. `profiles` holds display name and bio only. Profiles are created
automatically, but a new account is not a member until an invite is accepted.
Only public-story authors' profiles are visible to visitors; authors should know
their display name and bio will become public. Moderators can read profiles/drafts.

| Table | Purpose | Client access |
| --- | --- | --- |
| profiles | Auth UUID, public display name/bio | Own edits; own/staff/published-author reads |
| user_roles | One role per account | Own role or admin reads; no browser writes |
| invites | Email-bound hashed single-use token, expiry, revocation | RPC only; no table reads |
| stories | Author, slug, plain-text body, review status, timestamps | Public published reads; own draft/rejection edits |
| story_assets | Story, immutable storage path, alt text | Visible story reads; own draft/rejection metadata writes |
| moderation_log | Actor, status change, reason, time | Staff reads; moderation RPC appends atomically |

## Workflows

An authenticated admin calls `create_invite(invitee_email, valid_days)`; it returns
a random token once. Store/deliver it privately; never place it in public URLs,
Git, screenshots or logs. A verified user with the matching email calls
`accept_invite(invite_token)` using their signed-in session. Expired, revoked,
reused or wrong-email invites fail. `revoke_invite(invite_id)` is admin-only.
Invites always grant member, never moderator/admin. Invite delivery and the
acceptance screen are future UI work, not included here. Administrators inspect
invite IDs in the trusted Dashboard SQL editor, not through the browser.

Members create `draft` stories, edit them and set status to `submitted`. Submitted
stories are frozen. Staff call `moderate_story(target_story, decision, note)`:
`submitted -> published/rejected`, `published -> archived`, or
`archived -> submitted` for another review. Authors can revise rejected stories,
then save as draft or resubmit. No author can publish, change ownership, or edit a
published/submitted story. Staff use the RPC rather than direct status edits so
the decision and audit record commit together. Direct Dashboard/service-role
operations are trusted and can bypass client protections; use them sparingly.

For an image: create the draft, upload with `upsert:false` into
`fas-story-images` at `<author UUID>/<story UUID>/<new UUID>.png` (or jpg/jpeg/webp),
then insert `story_assets` with that exact path and meaningful alt text. Each file
has a 5 MiB limit; SVG and arbitrary files are excluded. A storage upload and an
asset row are separate operations: handle registration failure and clean orphaned
uploads with a trusted maintenance process. File extensions/MIME types do not
prove safe contents; add server-side image validation/re-encoding before allowing
untrusted uploads in a live community.

No client can overwrite or delete images. Authors/staff can read registered images
on visible stories; public readers additionally require explicit staff approval
through `approve_story_image(target_asset)`. Changing alt text clears that approval.
The bucket is private, including published images. The future
frontend can request short-lived signed URLs for published files under the public
read policy. Short expiry is useful but does not guarantee CDN cache revocation:
previously fetched URLs can serve cached bytes after archival. Follow the
hosted security guide before launch. Authors/staff can read registered
draft assets through their sessions. Files uploaded but not registered cannot be
read by regular clients. No image storage has been copied from static stories.

## Environments and secrets

Local project: `fas-community-v1`, API 55321, DB 55322, Studio 55323, Mailpit 55324.
These ports avoid the usual Supabase defaults; if another app occupies them,
change only FAS ports and update local URLs. Hosted: create `fas-community-dev`
and `fas-community-prod` separately. Dev contains disposable synthetic content;
prod contains real community data. The committed CLI config only configures the
local stack: hosted Auth settings require their own Dashboard setup.

`.env.example` contains blank public configuration names for future Vite integration.
Vite exposes every `VITE_` value to browsers; only URL and publishable/legacy anon
key belong there. The present site does not consume them. RLS provides the access
boundary, not secrecy of a publishable key. Secret/service_role keys bypass RLS:
keep them in server/Edge Function secrets or a temporary operator terminal only.
DB passwords and Supabase access tokens stay out of Git, frontend bundles and chat.
No backend server or Edge Function is deployed in this change.

Supabase files and docs are outside the existing Cloudflare build allowlist.
GitHub Pages may serve tracked documentation/SQL, so those files must always be
credential-free. Never store a backup beneath a publicly served folder.

## Changing the database later

Migrations are numbered recipes executed once, in filename order. Keep applied
files immutable. Add a new timestamped migration for each change and test a local
reset before hosted dev. Inspect `db push --dry-run`, verify the target project,
back up prod and deploy only a reviewed change. Do not use remote reset as a
deployment method. Do not push into an existing database without first inspecting
and baselining its schema; these initial migrations expect a fresh FAS project.

Official references: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Storage permissions](https://supabase.com/docs/guides/storage/security/access-control),
[migration workflow](https://supabase.com/docs/guides/local-development/cli-workflows).
