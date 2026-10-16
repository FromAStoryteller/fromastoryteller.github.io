# Production authentication email setup — 16 October 2026

Ryan explicitly approved installing the reviewed production confirmation/recovery
templates and exact callback URLs. Both subjects are now saved:

- Verify your From A Storyteller email
- Reset your From A Storyteller password

The saved HTML in both editors was copied through the UI and compared exactly
with its reviewed source, normalising CRLF to LF, before saving and again after
reloading. A first editor replacement retained old text; comparison caught that
before save. Full replacement and exact comparison then passed. No malformed
template was saved. The saved recovery preview shows the intended wording,
one-hour expiry, explicit recovery step and no DEV label. The two focused email
tests pass. This verifies stored source/preview, not actual email-client rendering
or inbox delivery. No real token was entered or email sent.

The redirect allowlist now contains exactly:

- https://fromastoryteller.com/account/verify-email/
- https://fromastoryteller.com/account/reset-password/

The existing Site URL remains https://fromastoryteller.com. No wildcard or other
origin was added. The provider's current Email OTP expiration is 3600 seconds,
matching the reviewed one-hour copy. Password/security settings were inspected
without saving: email confirmation is on and signup/anonymous/manual linking
remain off.

Custom SMTP remains enabled with sender name From A Storyteller, smtp.resend.com
and port 465. Stored SMTP credentials were not read, replaced or submitted. The
public From address is privacy-redacted in text tools and clipped in the narrow
UI, so its complete spelling was not reliably verified; leave it unchanged and
verify the actual From header in the later delivered message. Do not claim a
specific full address from a partial visual field.

The connected Resend domain check confirms auth.fromastoryteller.com is verified,
sending enabled, receiving disabled, region ap-northeast-1, and open/click tracking
both false. This was read-only; no DNS or provider setting was changed. Provider
domain verification alone does not establish real-inbox deliverability.

The lifecycle flag was not changed and remains false from the preceding guarded
deployment. No website/policy publication, release record, account agreement or
registration enablement occurred. Existing policy snapshots and acknowledgements
are unchanged. Play My Path was not accessed.

Next: prepare the final concrete policy/website activation review and controlled
real-inbox signup/recovery/export/deletion checks. Public signup needs deliberate
approval and Ryan available to enter passwords, verify email and accept any real
Terms himself. It cannot be described as a private test while global signup is on.
No blanket legal-compliance or completed viewer-account launch claim is made.

## Installed template checksums (UTF-8 LF)

- confirmation-production.html: 28d07c08cb0f45bad453a219ff9dc4ea0ab5da4143f3870cc61de487a1b224d2
- recovery-production.html: 18531e5f6e1ad02bf231d3429444713b65df96b0dbda5c3ffc73335e3087d79c
