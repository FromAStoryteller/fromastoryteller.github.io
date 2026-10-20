# Social links and account actions

The supported public social catalogue is Instagram, Facebook, TikTok, YouTube and X. Each platform has one optional HTTPS link, with an allowlisted platform hostname. TikTok /@handle paths are accepted; credentials in the URL authority remain blocked. Website and other platform links are not offered. The same catalogue filters profile, story, game/tool and file-backed server-rendered bylines.

An additive database trigger rejects newly changed unsupported social links. Existing stored legacy links are retained in private account exports and may remain unchanged during unrelated profile updates. Public projections hide unsupported entries, and the profile editor explains that its next save replaces older links with the supported entries shown. No existing saved profile text or image is removed by the migration.

Destructive action rule (Ryan, 20 October 2026): Remove/Delete and comparable destructive controls use the shared account-danger class with the site's red/wine semantic colours. Hover uses wine with parchment text, and keyboard focus uses the same semantic error colour. Ordinary Cancel and navigation buttons keep the standard treatment. This applies to social-link removal, profile-image removal and existing account deletion controls.

Adjacent account actions use account-action-group, with a 1rem vertical gap. This covers account downloads/game-save navigation and deletion review/confirmation actions on phone and desktop.

Advertising remains inactive. Current audience counts are opt-in estimates and are not a revenue ledger. The existing reports support stable page/beneficiary IDs, provider keys, impressions and revenue in integer micros with currency. Future monetization should import authoritative provider reports by canonical page/channel, keep imports idempotent, reconcile time zones and currencies, label estimates separately from finalized account payments, and never infer attributable revenue from FAS view percentages.
