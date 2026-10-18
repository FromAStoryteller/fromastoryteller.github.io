# Viewer and contributor profiles

Status: merged in PR #12 at `504840fc053cc70824e2eb18d113574e91d0c3fa` and deployed on 16 October 2026 UTC. Both profile migrations are installed in development and production. Signed-in production save/reload and public-page acceptance passed.

## Behaviour

- `/account/profile/` provides My corner. Viewers and accounts without a public author page get only a display-name field, Save and account/security navigation. There is no preview, bio or welcome field on that screen. Contributors get display/pen name, welcome line, bio, a live text preview and a public-page link. Name-only saves preserve other stored text. It uses the existing account client, session restoration and lifecycle. Account/security controls stay at `/account/settings/`, which links to My corner.
- Name: trimmed, 1–80 Unicode characters. Welcome: trimmed, up to 160. Bio: trimmed, up to 1,000. No role or account identity fields are editable. Email is absent from the profile page.
- Viewers have private profiles. A contributor (`member` in the existing database) has a public page, even before a first story. Contributor, moderator and administrator accounts have the same profile fields and public-page access before or after their first upload; only the story list depends on published work. Staff status is never displayed publicly. An author who loses contributor privileges retains attribution for existing published work.
- `/storytellers/?author=<public_id>` shows public name, welcome, bio and published stories in pages of 12. Story cards reuse the site's shared renderer, typography, overlays and 16:9 artwork frame. Selected, approved covers use the existing no-store image endpoint by asset ID; missing/unavailable artwork uses a neutral branded fallback. No storage path or signed token is exposed. The stable public ID is separate from the Auth UUID and cannot be changed by clients. Profiles disappear when account removal starts.
- `/read/?story=<slug>` renders a database-backed published story as text and links its current author name to the public profile. Name changes preserve author ownership. Existing static stories and their credits are untouched; no account mapping has been invented.
- Profile photos, cover uploading/picking in Studio, featured-story selection and richer prose formatting are outside this implementation. The story cover relationship and public display are implemented: a cover must belong to that story and remains hidden unless approved. Existing publication/edit restrictions still apply. Initials provide the current profile image treatment. Public routes remain noindex for this initial launch stage.

## Privacy and permissions

Raw profile rows are now readable only by their owner and existing staff. Public reader functions return a fixed whitelist: no email, account timestamps, roles, private drafts, Auth metadata or Auth UUID. Existing legacy story-table APIs still expose their author relationship identifier as published-content metadata; the new page responses/URLs do not use it. That identifier must never be treated as secret or as authorization.

`fas_public_profile` and `fas_public_story` intentionally use SECURITY DEFINER to read public projections while raw profiles remain private. They have empty search_path, explicit publication/lifecycle predicates, no writes and explicit execution grants. The normal PUBLIC execution grant is revoked. Their anonymous/authenticated advisor warnings are expected and reviewed, not blanket certification of the project. See [public function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). No new ERROR-level advisor findings were reported. The existing development leaked-password-protection warning is unchanged: [guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Server-side constraints and existing ownership/lifecycle RLS enforce changes, independently of the form. The UI uses textContent/value for all user content. Saves refresh and verify identity, reject account changes and require a returned saved row. Sign-out or account changes dispose private controls. Existing account exports include the new profile fields.

## Verification

The full Node suite and PostgreSQL profile tests cover cross-user reads/edits, protected public ID, Unicode limits, blank names, long welcome lines, published-only pagination, current bylines, approved cover projection, cross-story cover denial and account removal. `supabase/tests/profiles-hosted.sql` passed against development under anon/authenticated database roles with all fixtures rolled back. Signed-in development browser checks verified saving, persistence after reload and restoration of the original name. The simplified name-only form also saved successfully.

Browser checks verified the actual development API's anonymous public profile, published story and linked byline using a disposable fictional contributor. The fictional local preview verified save feedback and live text updates. Reference and syntax validation and both Cloudflare builds passed. Production migration SQL hashes, function definitions, execution grants, profile RLS and canonical migration versions match development. Auth, existing profile text and role fingerprints are identical before/after rollout. Anonymous unknown profile/story checks return null. Live unknown profile/story pages show unavailable states.

## Preview and release

`node scripts/profile-preview-server.mjs` serves the fictional component preview at `http://127.0.0.1:55420/tests/profile-preview/`. Contributor, Viewer and Public page links switch views. The preview directory is excluded from deployed builds. Optional `--dev` uses an ignored `.preview-dev-config.json` containing only the development publishable key and serves the existing development adapter on port 55410. Prefer the normal `npm run dev:accounts:dev` when CLI access is available.

Both exact migrations were applied to production before merging/deploying the matching UI. The connector-generated migration ledger versions were normalized to the committed versions only after guarded exact SQL hash checks. The production schema must precede the UI because account export/loading selects the new columns. Do not expose fictional test pages or local public-key configuration. Repeat the SQL suite and direct public API checks after deployment.

The source database still uses reviewed publication. Independent contributor publishing remains a separate known workflow mismatch; this change does not modify story publication, invitations, moderation, account deletion or image approval.

Staff-profile follow-up: migration 20261016194500_staff_storyteller_profiles.sql corrects staff author-page eligibility before the first database story. Account settings separates Edit my profile from View public profile. Regression tests compare new and established contributor projections and check staff pages without stories while viewers remain private.

Account settings cleanup: display name, welcome line and bio are edited only at /account/profile/. Account settings contains account details, policy history, exports and removal controls. The two profile navigation actions have separate button outlines and a wrapping layout with a 1rem gap.

## Profile images

Private normalized uploads, square cropping, descriptions, replacement/removal and contributor/viewer visibility are implemented in [image storage](image-storage.md). Profile text and image versions save independently.
