# Guarded production lifecycle deployment — 16 October 2026

Ryan explicitly approved deployment of fas-account-lifecycle with platform JWT
verification disabled and its production opt-in initially false, after automatic
approval review requested confirmation of that security configuration. The
previous rejection was resolved by this explicit approval; it was not bypassed.

Only FAS_PRODUCTION_LIFECYCLE_ENABLED=false was set. This is a non-secret feature
switch stored through Supabase's secrets API; no existing credential was read or
changed. Only fas-account-lifecycle was deployed, using the reviewed custom
authentication handler and its exact project/origin guards. Version 1 is ACTIVE
in the function inventory with verify_jwt=false. ACTIVE means deployed; the
application feature switch still prevents every account operation.

Six real HTTP checks passed: anonymous GET, anonymous account-export request,
synthetic bearer, deletion preparation without credentials, synthetic deletion
receipt and foreign-origin request. Every response was HTTP 404 with exactly
Account lifecycle is unavailable, no data, and Cache-Control no-store. No real
password, identity token, receipt or account was used. These are disabled-mode
checks; they do not prove live export/deletion, correct enabled-mode CORS or a
real production sign-in/session flow. The original handler's local/DEV enabled
security tests remain separate evidence.

After deployment, aggregate SQL checks show one user/profile/administrator, zero
policy releases/agreements/deletion jobs and a NULL requirement. Twelve successful
scheduled lifecycle-retention executions are recorded. Registration was visibly
OFF in the production dashboard before opening the function inventory; no signup
setting was saved. The immutable policy catalog and website remain inactive.

The existing image function's code digest and timestamp match the prior inventory.
Its reported revision is now 2 rather than 1 after the project configuration
update; the deploy command selected only fas-account-lifecycle. Do not describe
the existing image function as still revision 1 or claim that it was redeployed
from changed source.

Next: install the reviewed production verification/recovery email subjects/bodies
and the two exact callback URLs. Registration must remain off. That configuration
is separate from this deployment approval. Policy publication, website release,
lifecycle opt-in true and an initial public signup window still require the later
deliberate release sequence. Ryan enters passwords and accepts real Terms himself.
No real email/account lifecycle smoke test or legal certification is claimed.
Play My Path was not accessed.

## Deployed source checksums (UTF-8 LF)

- index.ts: f99246e87b554a2b273345786f56817d0f946daf67a6bc812fa0d03b76d6b9ef
- environment.mjs: 2ca2d28449c047b79a48baec10ef690622c5f456b4adf1b309d0d68cc0c3418d
- handler.mjs: 636d453275005bb097432764e730eb1bc83da1a489d0561695197b3f4d3ec441
- archive.mjs: 3a1acc5f0edcac5455841d227a1f439c303aacdc76c144ece7a6b46e5160bca0
