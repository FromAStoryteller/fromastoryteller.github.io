# Publishing names and existing content — release preparation

Status: implemented and verified in DEV. Production ownership and publishing-name controls are **not installed or deployed**. Waiting for a fresh production backup under the existing operating procedure.

## Live button correction

PR #29 groups Download text and Delete draft together. PR #31 also matches their typography and sizing. Main: eab3c551305c573093ab7f068e02dddf5e03f479.

Chromium checks at 1440, 768 and 390 px verified aligned top edges, matching 44 px heights, no overlap or horizontal overflow. The production CSS/editor and public Studio shell passed an exact-source, read-only HTTP verification. No authenticated production requests or draft mutations were used.

## Behavior prepared in PR #30

- Associate the existing ten file-backed stories, two games and two tools with the one explicitly verified site-owner account.
- Stories and games start with the account's personal display name, currently Ry. Tools always publish as From A Storyteller.
- Public publishing identity is independent of private account ownership and stable page/report identifiers. Only the explicitly granted account can select the FAS name; ordinary contributors remain personal authors.
- Existing work appears in the Studio library, with publishing-name settings and insights. Existing file-backed content stays in its source files; it is not duplicated into the story writer. Game/tool creation remains disabled.
- Community stories and blog posts get the same personal/FAS choice, defaulting to personal. The current production draft retains its content, cover state and address.
- Reader bylines, social links, public profiles, author search fields and structured metadata use the selected identity. Brand metadata uses Organization; personal metadata uses Person.
- FAS uses the existing site social destinations. Personal work inherits the contributor's social links.
- Personal and FAS storyteller pages have separate selectors in the account's insights. Trusted report imports retain the same beneficiary regardless of byline changes. No analytics provider, ad delivery or earnings are activated.
- File publishing settings use server-side owner/session checks and optimistic version checks. Tools cannot be changed to personal. Anonymous calls receive explicit public projections, not owner IDs, emails, Auth identifiers or permissions.
- Public file-backed pages use the published-owner gate at the server. Removed/inactive contributors return 404; unavailable backend/configuration returns 503 with noindex and no-store. Existing canonical addresses and referral parameters are retained.

## Reviewed database sources

Migration filename was generated with Supabase CLI 2.120.0 in the preparation workflow; it was not invented or renamed.

| Source | SHA-256, UTF-8 LF | DEV recorded version |
| --- | --- | --- |
| 20261017192623_publishing_identity_and_legacy_ownership.sql | 1c666108f036fd4c8ad7c4f71e7c601cf9e1e8df9d9f36ea45662a098af067d7 | 20261017193922 |
| supabase/ops/claim-existing-site-content.sql | 69096cf6f707657fd0f729f3682c79e1b9f23c42fe106208339da55e443136fa | Separate explicit claim, not migration history |

The portable migration seeds 14 unclaimed file records and an organization identity. It does not embed generated Auth/profile identifiers or infer rights from editable user metadata. The separate claim resolves exactly one confirmed account from the operator-requested email, verifies active contributor access and the exact 10/2/2 inventory, and rejects conflicting existing ownership or grants. It never updates public.stories, drafts or uploaded objects.

## Verification

- All 139 Node tests passed, including real PostgreSQL/PGlite migrations, the verified-account claim, personal defaults, brand projections, other-owner denial, stale-save rejection, fixed tool authors, profile grouping and stable report attribution.
- Full hosted DEV SQL fixture passed and rolled back. DEV before/after: one existing story and one existing asset preserved; 14 unclaimed registry rows; zero publisher grants; zero named fixture accounts. No Storage bytes were created, fetched or removed.
- Desktop/tablet/mobile browser checks passed: personal/FAS selection and preview, persisted file publishing choices, content insights navigation, fixed tool controls and no browser errors.
- Reference validation, generated-index consistency, public build and Worker bundle checks passed.
- DEV security advisor categories remain the documented default-deny private tables and explicitly granted checked definer functions, plus the pre-existing leaked-password setting notice. No new exposed-table category.
- Production read-only baseline: one account, one Community draft, zero registered covers. New attribution tables are absent. No production test accounts or fixtures were used.

## Required manual gate

[backup-restore.md](backup-restore.md) states: **"Export production weekly and before database changes"**. Its operating choice assigns export encryption, password custody, archive testing and off-site sync to Ryan.

The previous confirmed production backup was 17 October 2026 at 09:59 UTC, before the current draft. A fresh complete export is required for this release. Do not overwrite the earlier backup or request its password, SQL data or secret key in chat. Use a new dated private directory, include all five SQL files and the Storage inventory/bytes, encrypt the entire directory with encrypted filenames, test the archive and confirm the off-site copy.

No new backup password, key or database contents should be committed. Record confirmation time and scope only.


### Fresh backup commands

Run from the existing FAS checkout. Keep site editing/uploads paused until this export is complete. This example uses a new folder beside the previous backup, outside the repository.

```powershell
$fasBackup = 'C:\Users\Ryan\Documents\FAS-Backups-Private\2026-10-17-publishing-names'
if (Test-Path -LiteralPath $fasBackup) { throw 'Choose a new empty backup folder; keep the earlier backup.' }
New-Item -ItemType Directory -Path $fasBackup | Out-Null

npx --yes supabase@2.120.0 db dump --project-ref vzdicnufhidelaoeqbza --role-only -f "$fasBackup\roles.sql"
if ($LASTEXITCODE -ne 0) { throw 'Roles export failed' }
npx --yes supabase@2.120.0 db dump --project-ref vzdicnufhidelaoeqbza --schema public,private -f "$fasBackup\schema.sql"
if ($LASTEXITCODE -ne 0) { throw 'Schema export failed' }
npx --yes supabase@2.120.0 db dump --project-ref vzdicnufhidelaoeqbza --data-only --use-copy --schema public,private,auth -f "$fasBackup\data.sql"
if ($LASTEXITCODE -ne 0) { throw 'Data export failed' }
npx --yes supabase@2.120.0 db dump --project-ref vzdicnufhidelaoeqbza --schema supabase_migrations -f "$fasBackup\history-schema.sql"
if ($LASTEXITCODE -ne 0) { throw 'Migration schema export failed' }
npx --yes supabase@2.120.0 db dump --project-ref vzdicnufhidelaoeqbza --data-only --use-copy --schema supabase_migrations -f "$fasBackup\history-data.sql"
if ($LASTEXITCODE -ne 0) { throw 'Migration data export failed' }

$env:FAS_STORAGE_URL = 'https://vzdicnufhidelaoeqbza.supabase.co'
try {
    $env:FAS_STORAGE_SECRET_KEY = [System.Net.NetworkCredential]::new('', (Read-Host 'FAS production secret key' -AsSecureString)).Password
    node scripts/fas-storage-backup.mjs export "$fasBackup\images"
    if ($LASTEXITCODE -ne 0) { throw 'Storage export failed' }
} finally {
    Remove-Item Env:FAS_STORAGE_SECRET_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:FAS_STORAGE_URL -ErrorAction SilentlyContinue
}
Get-ChildItem -LiteralPath $fasBackup -Filter '*.sql' | Get-FileHash -Algorithm SHA256 | Export-Csv -NoTypeInformation -LiteralPath "$fasBackup\sql-sha256.csv"
```

Encrypt the **whole 2026-10-17-publishing-names folder**, including the five SQL files, SQL checksums and images/manifest.json (plus any exported image bytes). Use the previously established AES-256 7z procedure with encrypted filenames. Test the archive and sync the encrypted copy off-site before confirming. Do not upload the plaintext folder or send any backup contents/password here.

## Installation after backup confirmation

1. Recheck PR #30 head/checks, main and production counts. Recheck the verified account and content inventory. Compare the two source hashes above.
2. Apply only the reviewed migration to PROD vzdicnufhidelaoeqbza. Record its production-generated timestamp here; preserve earlier repository/hosted mappings. Do not blindly push or repair migration history.
3. Run the explicit claim operation against that same project. Verify 10 personal stories, two personal games and two FAS tools, all owned by the verified account. The current Community draft must remain the same ID and content.
4. Check public projections and ACLs read-only. Verify page identifiers, original canonical addresses, tool authorship, personal/FAS grouping, report owner configuration and no private owner fields in public output. Do not create or publish a production fixture.
5. Merge PR #30 with an expected-head lease after the schema and claim succeed. The new frontend requires its new RPCs; do not deploy it first.
6. Wait for the main production deployment and verify all 14 existing pages, linked bylines, selected socials, structured metadata, personal/FAS profiles, account library and the current draft without editing it. Capture deployment/version and checks here.
7. Mark complete only after production evidence is recorded.

## Source-file and operations scope

These are existing repository pages, not imported manuscripts or a new game editor. Changing their body/game code remains the source-file workflow. Keep registry titles, descriptions and artwork in sync in the same reviewed source-content release; preserve registry IDs, ownership, selected publishing identity and canonical URLs.

The contributor download continues to export Community manuscripts and uploaded images. It does not package the site's static game/tool/story source files. The current site-owner account is staff and already uses a separately reviewed account-removal process. For any future reassignment/removal of file-backed content, review source files, metadata, ownership and public routes together; hiding an owned route does not erase historical repository bytes.

Restores must reconcile the migration's seeded brand and 14 file records with the backed-up current rows rather than blindly appending duplicate primary keys. Restore current ownership, publishing choices and stable identifiers. Do not run the initial claim to reset restored data. Retain the newest account-deletion ledger.

No Edge Function, policy text, Auth/SMTP, DNS, provider or payment changes are part of this release.

## Rollback

Before frontend merge, leave the existing production site in place if schema/claim verification fails. Do not drop accepted content or remove the new additive schema.

After merge, restore the previous website deployment or revert the frontend release. Retain ownership and report identity records; prefer a reviewed forward fix. A website rollback does not undo database changes. Never use the synthetic DEV fixture or a production restore as an ad-hoc rollback.
