# Future FAS game saves and multiplayer

Planning only. No new game telemetry/tables, current game changes or Play My Path
integration are introduced by this document. Collect only data needed for an enabled
feature, not everything that might become useful. Reassess Privacy/Terms before launch.

## Data inventory and ownership

| Feature | Likely data | Access and lifecycle |
| --- | --- | --- |
| Cloud saves | Stable account UUID, game ID, save-slot ID, bounded/versioned progress, timestamps | Owner only by default; include in export; remove on confirmed deletion |
| Game preferences | Game ID, accessibility/control/audio preferences, version | Owner only; allow reset; preserve anonymous local-only play where feasible |
| Achievements/statistics | Account UUID, game ID, achievement IDs, verified results, timestamps | Private unless an explicit public feature requires visibility; prevent client-forged scores |
| Multiplayer room | Room ID, game/version, host, membership, room visibility, status, expiry | Participants only for private rooms; invitation codes are secrets; expire abandoned rooms |
| Live multiplayer | Minimal participant ID, transient moves/state, connection presence | Server verifies membership for every channel/action; reject spectator writes; expire transient state |
| Match history | Match ID, participants, outcome, timestamps, necessary anti-cheat evidence | Define visibility and retention before implementation; export the requester's data without exposing another player's private data |
| Public leaderboard | Chosen public display name, validated score, game/version | Deliberate public visibility and reporting/removal rules; never expose email, IP, session or invitation tokens |
| Safety/security | Necessary abuse reports, moderation actions, limited security events | Staff access only, purpose-based retention; document any justified exception to deletion |

Chat, voice, precise location, contacts, device fingerprints, advertising IDs and
biometrics are not assumed or authorised by multiplayer. Assess them separately if
ever proposed. An ordinary network connection already involves IP/request processing
by service providers; this does not justify a permanent application IP-history table.

## Implementation contract

- Use immutable account UUIDs for ownership and references. Usernames can change.
- Scope save keys to `(owner_id, game_id, slot_id)` and version payloads; validate a
  strict per-game schema, size, save frequency and allowed fields on the server.
- RLS uses `auth.uid()` with ownership and `WITH CHECK`; viewers may save/play without
  receiving contributor/moderator privileges. Keep creator permissions separate.
- Keep private saves out of public content indexes, caches and search. Share a save
  only through an intentional, separately secured feature.
- Resolve concurrent writes with revision checks; handle offline conflicts clearly.
  Never silently overwrite newer progress. Make imports/export formats versioned.
- Treat game clients as untrusted. Authoritative match outcomes/scores, room joins,
  turn order and rate limits are server-validated. RLS alone does not validate gameplay.
- Realtime topics must be private where required, with server-checked membership,
  join/leave/reconnect expiry and no privileged keys in browser code.
- Use a unified export manifest with version, owned records, uploaded originals,
  save payloads and the user's permitted match data. Fail clearly if incomplete;
  never label a profile-only JSON as an all-content export.
- Account deletion must revoke access, close active participation, remove private
  saves/owned game content/uploads and handle shared match records without deleting
  other people's data or leaving the deleted user's identifiable information public.
  Define any irreducible shared-record/abuse-evidence exception in the policy first.
- Include all data stores, caches, queues and backup copies in deletion testing.
  Ryan selected a 30-day maximum for deleted-account data in backups, including
  manually saved Dropbox archives. Retain a minimal deletion record long enough to
  prevent restoration from resurrecting deleted accounts/content, then expire it.

## Launch gates for each feature

Confirm exact fields/purpose, public/private defaults, retention periods, processors,
regions, age/safety implications, export and deletion behavior. Update the actual
Privacy/Terms notice before collection starts. Do not claim blanket consent for
unknown future features through today's Terms or signup checkbox.

Test two users, a non-participant, viewer/contributor role separation, expired/revoked
sessions, forged saves/scores, concurrent writes, reconnect, exports, deletion and a
restore with deletions reapplied. Keep FAS dev/prod and Play My Path isolated.
