# Provider and operating review — 15 October 2026

This records public terms and read-only settings, not acceptance of new contracts or a legal opinion. Ryan's email-only public contact remains unchanged. No secret, support message, plan purchase or production change was made.

| Service | Review evidence | Remaining operating check |
| --- | --- | --- |
| Supabase | DEV and production are Sydney projects. The current DPA forms part of its customer agreement, describes processor duties/region instructions, subcontractors and incident assistance. Its agreement-end deletion provision is distinct from an end user's account deletion. | Keep the terms applying to Ryan's account; verify production configuration, deletion/backup recovery and provider records. Do not equate primary data region with all processing locations. |
| Resend | Public DPA is incorporated into its customer agreement, describes processing for email delivery and a separate termination deletion period. Public security information describes 30-day email/log retention on standard plans and seven-day backups. DEV verification/recovery delivery passed. Production SMTP is already enabled using Resend on 465 with a 60-second per-user interval. | Confirm the current account/plan settings and final production sender/templates. Independent account/security/legal records can differ from message retention; don't promise that deleting a FAS account immediately erases every provider record. |
| Cloudflare | Customer DPA is published. Production website delivery already uses Workers; both PR checks build branch previews. | Retain applicable customer terms and verify actual logs/drains/Workers storage. Do not infer a universal log expiry from a dashboard query window. |
| Gmail and manual backup storage | Existing email contact and encrypted manual archive workflow were chosen by Ryan. A 30-day archive removal/replacement rule is agreed. | Maintain the private archive inventory and remove/replace old copies. Consumer correspondence/storage use is not automatically evidence that a business-only DPA applies. Check the agreements applicable to the actual accounts. |

Sources: [Supabase DPA](https://supabase.com/legal/customer-resources/data-processing-addendum), [Resend DPA](https://resend.com/legal/dpa), [Resend security/retention](https://resend.com/security), [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/), [NZ overseas processing guidance](https://www.privacy.org.nz/privacy-principles/12/).

## Security-record retention decision

Ryan selected 30 days for the site's own authentication/security audit records, with longer retention only for a specific ongoing incident or legal need. This is a purpose-specific rule, not an obligation to collect more logs. Record the reason, owner and review/deletion date for an exception and restrict access; don't grant an indefinite blanket exception.

Current FAS lifecycle records already expire within shorter/30-day thresholds: expired confirmation intents, one-day action-limit windows and completed deletion receipts at 30 days, with cleanup scheduled in DEV. Related Cron history expires after seven days. Pending deletion records are operational work requiring resolution, not completed records to erase before cleanup finishes.

DEV `auth.audit_log_entries` currently contains zero rows. Supabase documents database audit storage as optional and external log storage separately. A public dashboard retention period is not proof of deletion from every provider system. No provider-managed audit settings were changed or security logs purged in this review. If the site later writes its own security audit stream, implement the approved 30-day rule and explicit incident holds before enabling it. Production audit storage/retention still needs verification at rollout. [Supabase audit storage](https://supabase.com/docs/guides/auth/audit-logs).

The personal account/registration/agreement record is not a rotating authentication audit log: it supports the ongoing account and is removed with Auth identity deletion. Public policy snapshots contain no registrant identity and stay available as version history. Moderator decisions and correspondence have their separately stated purpose/retention rules.

## Release boundaries

Production remains on the original five security migrations, signup disabled and only the image delivery function installed. The account lifecycle/policy migrations, lifecycle function, retention jobs and public account frontend require a deliberate reviewed rollout. Final policy publication, real production email checks, a current encrypted backup and an isolated hosted recovery check remain necessary. Don't change the production flags while preparing these steps.
