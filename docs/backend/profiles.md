# Viewer and contributor profiles

Status: implemented in an isolated checkout based on main `f72798166ff5ab2889c6710dabef9d3ac365ca6d`. Migration `20261016190453_viewer_contributor_profiles.sql` is applied to FAS development only. Production deployment and signed-in browser acceptance remain pending. Do not mark the workbook task complete yet.

## Behaviour

- `/account/profile/` provides My corner: display/pen name, optional welcome line, bio, a live text preview and a public-page link where applicable. It uses the existing account client, session restoration, role lookup and account lifecycle. Account/security controls stay at `/account/settings/`, which links to My corner.
- Name: trimmed, 1–80 Unicode characters. Welcome: trimmed, up to 160. Bio: trimmed, up to 1,000. No role or account identity fields are editable. Email is absent from the profile page.
- Viewers have private profiles. A contributor (`member` in the existing database) has a public page, even before a first story. Staff accounts become public author pages only when they have published work; staff status is never displayed publicly. An author who loses contributor privileges retains attribution for existing published work.
- `/storytellers/?author=<public_id>` shows public name, welcome, bio and published stories in pages of 12. The stable, server-generated public ID is separate from the Auth UUID and cannot be changed by clients. Profiles disappear when account removal starts. Public IDs are identifiers, not credentials.
- `/read/?story=<slug>` renders a database-backed published story as text and links its current author name to the public profile. Name changes preserve author ownership. Existing static stories and their credits are untouched; no account mapping has been invented.
- Photos, cover artwork, featured-story selection and richer prose formatting are outside this implementation. Initials provide the current profile image treatment. Public routes remain noindex for this initial launch stage.

## Privacy and permissions

Raw profile rows are now readable only by their owner and existing staff. Public reader functions return a fixed whitelist: no email, account timestamps, roles, private drafts, Auth metadata or Auth UUID. Existing legacy story-table APIs still expose their author relationship identifier as published-content metadata; the new page responses/URLs do not use it. That identifier must never be treated as secret or as authorization.

`fas_public_profile` and `fas_public_story` intentionally use SECURITY DEFINER to read public projections while raw profiles remain private. They have empty search_path, explicit publication/lifecycle predicates, no writes and explicit execution grants. The normal PUBLIC execution grant is revoked. Their anonymous/authenticated advisor warnings are expected and reviewed, not blanket certification of the project. See [public function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). No new ERROR-level advisor findings were reported. The existing development leaked-password-protection warning is unchanged: [guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Server-side constraints and existing ownership/lifecycle RLS enforce changes, independently of the form. The UI uses textContent/value for all user content. Saves refresh and verify identity, reject account changes and require a returned saved row. Sign-out or account changes dispose private controls. Existing account exports include the new profile fields.

## Verification

All 95 Node tests passed, including the PostgreSQL profile suite and all existing account/security suites. The profile tests cover cross-user reads/edits, protected public ID, Unicode limits, blank names, long welcome lines, published-only pagination, current bylines and account removal. `supabase/tests/profiles-hosted.sql` passed against development under anon/authenticated database roles with all fixtures rolled back. This is hosted SQL/RLS verification, not a complete signed-in HTTP test.

Browser checks verified the actual development API's anonymous public profile, published story and linked byline using a disposable fictional contributor. The fictional local preview verified save feedback and live text updates. Reference and syntax validation and both Cloudflare builds passed. No production schema or deployment changed.

## Preview and release

`node scripts/profile-preview-server.mjs` serves the fictional component preview at `http://127.0.0.1:55420/tests/profile-preview/`. Contributor, Viewer and Public page links switch views. The preview directory is excluded from deployed builds. Optional `--dev` uses an ignored `.preview-dev-config.json` containing only the development publishable key and serves the existing development adapter on port 55410. Prefer the normal `npm run dev:accounts:dev` when CLI access is available.

Before release, finish a signed-in browser save/reload/sign-out check against development, apply the exact migration to production, verify privacy/permission parity, then merge/deploy the matching UI. The production schema must precede the UI because account export/loading now selects the new columns. Do not expose the fictional test pages or local public-key configuration. Repeat the SQL suite and direct public API checks after deployment.

The source database still uses reviewed publication. Independent contributor publishing remains a separate known workflow mismatch; this change does not modify story publication, invitations, moderation, account deletion or image approval.
