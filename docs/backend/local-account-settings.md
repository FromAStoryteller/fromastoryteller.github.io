# Local profile settings and account-data export

`/account/settings/` works only in the isolated local FAS preview. Sign in and use
the Account settings link. Hosted settings stay inactive. No production data changed.

- The server verifies identity and refresh-session validity before profile/export
  operations. Existing RLS restricts profile editing to the owner; role columns are
  never editable here. Display name is cosmetic, not a unique username.
- Email and access level are read-only. Bio and display name use the existing schema
  limits. Public profile fields may be visible with published work; email is not
  written to the public profile.
- Download account data produces a JSON file with minimal account details, profile,
  role and owned story text. It excludes passwords, tokens, image originals and
  unlinked static content. The page/file explicitly describe those exclusions.
- This is **not** the complete contributor-content export required before deletion.
  Contributor deletion must include images and future account-owned games. Existing
  static stories/games are not imported or assigned to test identities.
- Account deletion is displayed as preparation, with no enabled destructive button.
  The trusted server workflow is specified in [lifecycle decisions](account-lifecycle-decisions.md).
  No browser delete grants or privileged keys were introduced.

The local API test creates two disposable accounts, verifies own-profile editing and
cross-user denial, confirms viewers have no role, then adds temporary contributor
fixtures and verifies the export includes only its owner's private story text and no
session credentials. All test accounts/story rows are removed. Browser checks cover
profile save and an actual downloaded JSON file with no credential fields.

Run `npm run test:settings:local` with process-only local FAS test credentials and
`FAS_TEST_CONFIRM=LOCAL-FAS-ONLY`, as for the other local Auth test scripts.
