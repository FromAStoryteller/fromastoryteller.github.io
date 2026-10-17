# Cookies and site-storage choices

The popup offers Essential only, Allow optional storage, or separate settings.
Neither optional category is enabled before a valid choice. The two primary actions
have equal presentation. The footer always reopens Storage choices; the native dialog
supports keyboard focus/Escape and cancel does not silently accept.

| Choice | Behaviour |
| --- | --- |
| Essential only | Browse/play still work; no persistent theme, sound or game records |
| Preferences | Remember colour theme and Rally Clash sound/volume on this device |
| Game records | Remember Brick Blitz high score and Rally Clash best rally |
| Studio writing recovery | Automatic account-scoped tab copy while editing; offered for 24 hours, cleared on save/discard/Studio sign-out; no setting or localStorage history |
| Essential account access | A session is created only when an account flow is used; sign-out clears its tab cache |

The choice itself is essential preference storage, versioned and limited to 180 days.
Expired/malformed choices do not authorise optional reads/writes. Browser-blocked
storage falls back to the current page. Withdrawal removes only the explicitly named
optional keys; it never clears unrelated storage or account/cloud data. Existing
in-memory play/preferences can remain until navigation. Global game storage refuses
unknown future keys until their category is deliberately registered and reviewed.

No analytics, advertising, chat, voice or future multiplayer collection was added.
Loading hosting/CDN resources is separate from accepting optional device storage.
This popup does not promise to block necessary network delivery or perform account
deletion. Future categories/vendors must default off until properly reviewed and
authorised. Local theme/game records are not sent to an account/server by this change.

Four tests cover defaults, malformed/expired choices, category separation, actual
game reads/writes, withdrawal scope and blocked storage. Browser tests verified
declining stops theme persistence, allowing it survives reload, and the footer
reopens editable choices. Privacy/Terms copy was aligned with the implemented choices.

Studio recovery is part of the requested writing flow and is separate from optional theme/game records. Browser-blocked recovery storage reports its limitation and leaves text/file download available under More options. Browser session restoration can retain tab storage; the 24-hour offer limit is checked when reading a copy. See [Studio recovery](studio-edit-autosave-recovery.md).
