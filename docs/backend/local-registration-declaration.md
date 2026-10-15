# Local age declaration and policy acknowledgement

This records the original local implementation. The same draft-declaration hook
is now enabled in FAS DEV for testing; see [current DEV status](hosted-dev-accounts.md).
Public production registration remains inactive.

The product proposal is 16+ accounts, with public reading available without an account. This is not a claim that New Zealand universally requires age 16. The form requires two unchecked boxes: 16+ self-declaration and acknowledgement of the local draft Terms/Privacy notice. It collects no birth date or identity document. This does not establish a person's real age, prove they read a notice, or grant any contributor/staff access.

The notice version is `local-preview-2026-10-15-v1`. Its mode is `local_draft_review`, deliberately separate from any future published agreement. Before launch, Ryan must review the actual policies and provider/retention arrangements; freeze published policy versions and implement the reviewed agreement wording. Never relabel these test records as acceptance of future live Terms. Preserve each published policy version when introducing a new version.

## Server controls

`public.fas_before_user_created(jsonb)` is enabled in the local Auth config. Only supabase_auth_admin can execute it. It requires exact JSON boolean true values, current versions and the local draft mode. Missing, false, string-typed and stale declarations fail before public signup creates an identity or sends mail. Browser validation provides helpful feedback but is not the gate.

The declarations are supplied by the registrant and are claims, not trusted authorization. User-editable role claims remain ignored. An insert-only trigger copies valid declarations into private.account_registration_declarations with server time; subsequent user_metadata edits cannot overwrite that record. Existing/admin-created accounts without a declaration retain no record, rather than fabricating past acknowledgement. Trusted administrative provisioning remains a separate workflow and is not proof of self-service compliance.

The private table has RLS and no browser table grants. The authenticated, self-only fas_my_registration_declaration() RPC has no account-ID argument and returns a record only for the caller's confirmed identity. It is included in the account-data ZIP and readable My-account.txt, with a truthful missing-record message for legacy/admin fixtures. Auth deletion cascades the declaration; normal backup retention still applies. No IP, date of birth or extra request logs were added to this record.

## Verification

SQL-engine and real local tests cover hook ACLs, missing/false/string/stale declarations, original timestamps/versions, profile-metadata tampering, viewer privileges, another account's isolation, anonymous denial, account export and deletion cascade. The direct signup/mail test also checks that rejected declarations create neither a user nor an email. Existing password, email verification, resend and expiry checks continue.

Sources: [Supabase before-user-created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), [Auth hook permissions and local configuration](https://supabase.com/docs/guides/auth/auth-hooks).
