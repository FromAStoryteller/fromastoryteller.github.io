# Privacy operations review — 15 October 2026

Ryan approved the draft wording as reflecting his intentions, conditional on legal coverage. This review records implementation and open operational points; it is not a certificate that every applicable law is satisfied. Public account registration remains inactive. A 16+ self-declaration is a product rule, not a universal New Zealand statutory age or proof of age. Accounts for teenagers, international visitors and contributor licensing need assessment against the actual service before launch.

## Collection notice

Current review update: Ryan expressly chose no postal address at launch. The new
review uses his name, New Zealand and the public email only. See
[policy versioning/contact rationale](policy-versioning-review.md) for the OPC
IPP3/IPP3A distinction; the earlier note below is not a demand to obtain or publish
a postal/home address. Final notice suitability still needs assessment for the service.

The registration form now explains why email, password and display name are required, that a bio is optional, and that public reading remains available without registration. It names Ryan Fearon as the responsible operator and links the detailed notice. A pseudonymous display name is sufficient. Provider locations, recipients, account exports and correction/contact routes are covered in the draft. Final published notices must accurately identify the collecting/holding agency and its address/contact details; confirm the appropriate public contact/address presentation for the eventual service rather than publishing a home address by default. [NZ OPC principle 3](https://www.privacy.org.nz/privacy-principles/3/).

## Responsibility, requests and incidents

Ryan is the named operator and privacy contact at fromastoryteller@gmail.com. Confirm/document who fulfils the privacy-officer role before opening accounts; a small operator can fulfil it personally and does not register the appointment with OPC. Record and manage requests, complaints and incidents rather than relying only on the website text. [NZ OPC privacy officers](https://www.privacy.org.nz/responsibilities/privacy-officers/).

For NZ personal-information access requests, record receipt and calculate the deadline using OPC guidance: respond as soon as reasonably practicable and normally within 20 working days. Any lawful extension needs timely reasons/notice. Do not treat account ZIP downloads as replacing the right to request other information, such as correspondence or relevant security records. Verify identity proportionately and do not demand identity documents by default. Track correction requests and explain refusals and complaint routes. [NZ OPC requesting information](https://www.privacy.org.nz/your-rights/ask-for-your-information/).

For a possible breach, contain it, preserve necessary evidence privately, assess serious harm and the applicable notification duties promptly, and use OPC's reporting guidance. Do not postpone action while waiting for a complete investigation. Provider incident notices also need an owner. [NZ OPC NotifyUs](https://www.privacy.org.nz/responsibilities/privacy-breaches/notify-us/).

## Providers, transfers and retention

Maintain a record for Cloudflare, Supabase, Resend, Gmail and manual backup storage: service purpose, actual settings, processing locations, contractual terms, access, provider logs and retention. Review whether each overseas arrangement is processing on the operator's behalf or a disclosure requiring IPP12 safeguards; a region label or Privacy notice alone is not evidence of compliance. Check the relevant contract/DPA and safeguards rather than adding blanket consent to all transfers. [NZ OPC principle 12](https://www.privacy.org.nz/privacy-principles/12/).

The local account workflow removes owned content and the Auth identity; a real isolated local restore rehearsal also passed. Hosted retention scheduling, the manual encrypted archive inventory and replay of the latest deletion ledger must be verified before public deletion. Ryan selected a 30-day maximum for deleted-account data in manual backups and will remove/replace older archives. The local receipt-expiry job does not delete Dropbox archives or independently held provider logs.

## Current launch boundaries

- Draft acknowledgement records must never be renamed as acceptance of future published Terms. Freeze/preserve the final published version and require the appropriate agreement prospectively.
- Hosted email delivery, exact redirects, safe verification/recovery callbacks, expired/reused links and account lifecycle still need development end-to-end testing.
- Publicly searchable profiles/ownership migration await the final account/username design. No content was assigned to temporary accounts.
- Future saves, multiplayer, public scores, abuse handling or chat need their own minimisation, security, visibility, retention and notice review before enabling them. No speculative data collection was added.
- Before opening public contributor submissions, have the teen-account rules and contributor licence reviewed for the actual intended jurisdictions and content. Existing wording review does not resolve enforceability or every international obligation.
