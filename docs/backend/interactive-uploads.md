# Games and tools in Storyteller Studio

## Creator workflow

1. Open Studio → Add content → Game or Tool (admins only). The content type and Publish as selectors stay above the editor. Admins can easily switch personal/FAS identities; tools always publish as FAS. Multiplayer requires the existing FAS publishing capability and switches the game to FAS. Server checks enforce these rules on every write.
2. Choose Landscape (1920 × 1080, 16:9) or Portrait (1080 × 1920, 9:16). These are logical coordinates; adaptive canvas backing resolution supports up to 2× density without requiring larger artwork for every device.
3. Choose account saves and/or Casual or Realtime multiplayer. Download starter ZIP. Extract it and open index.html in your editor’s local server. Single-player files can also open directly. Two-tab multiplayer demos require the same local server URL.
4. Edit game.js/game.css or tool.js/tool.css; keep local media in assets/. Each folder contains index.html, fas-runtime.js, meta.json and README.txt. The HTML is a standalone canvas plus optional DOM controls. The site owns its actual page shell; creator HTML cannot replace it. Preserve meta.json for orientation, entry filenames, save schema/version and multiplayer mode.
5. Upload the ZIP, select the extracted folder, or select source/metadata/media files together. Preview → Start. Enter title, description, controls, category and reviewed warnings; save a draft, add a cover/alt text, then publish or schedule. Replacements are atomic: a failed save keeps the previously published files.
6. Download current files whenever returning to your editor. Tab recovery, portable recovery, account export, archive and deletion include the executable package. Legacy main.js/style.css/fas.json imports remain accepted; exports always use canonical game/tool names.

## Runtime and account SDK

Use FAS.canvas, FAS.ctx, FAS.width/FAS.height, FAS.pointer(event), FAS.asset("sprite.png") and FAS.ui. CSS url(assets/sprite.png) resolves included media. Bundle dependencies into the classic JS entry file; remote modules/network access are unavailable inside uploaded code.

A published game shows a trusted Enable account features control outside its sandbox. The player must explicitly connect a verified account and review current policies. Session credentials stay in the parent; requests bind the exact published game/version and verified account. Game code receives neither emails nor account IDs. Stop/restart, disconnect, auth changes and room expiry end participation.

- FAS.account.get() reports enablement and demo mode.
- FAS.saves.load(slot), save(slot,data,{revision,version}), remove(slot,{revision}) use revision checks. Save data must match the declared bounded JSON schema. Load before overwriting. An incompatible schema/version must be migrated explicitly by the creator; do not silently discard old progress.
- FAS.multiplayer.create({capacity}), join(code), leave(), get(), updatePlayer(data), updateShared(data), onChange(callback) and lerp(from,to,amount) are included in the README.
- Casual sessions use turn/state updates; the starter is host-controlled noughts and crosses. Realtime sessions use authenticated state events with interpolation; the starter shows moving players. Shared state is host-owned, each participant writes their own player state, and the server enforces membership/revisions/limits. This is small-room host-authoritative play, without competitive anti-cheat or a physics server.
- Downloaded projects use explicit local demo saves and BroadcastChannel rooms. These are editor tests, separate from live account data and production security.

## Limits and privacy

- JS 256 KiB; CSS 64 KiB; up to 24 PNG/JPEG/WebP/GIF/MP3/OGG/WAV files, 1 MiB each; complete encoded package 4 MiB. ZIP imports are bounded, CRC checked, and reject unsafe paths, encryption, links and unsupported entries.
- Opaque iframe sandbox allows scripts only; CSP blocks direct network, frames, workers, forms and external code. Parent messages require the exact frame, fresh nonce, allowed methods and bounded JSON. Public code must contain no secrets. Creators still need performance testing; isolation is not a CPU/memory quota.
- Saves: five slots per game, 64 KiB per slot, 2 MiB per account. Strict schema validation and compare-and-swap revisions protect prior data. Saves survive removal of their game so the owner can export/delete them.
- Rooms: 2–8 players, one active room per account, 16-hex-character invitation codes stored hashed, exact game/version binding, two-hour expiry. Room data exposes seat IDs/gameplay only to current members. No chat, voice, public leaderboard or match history. Unfilterable Realtime deletion notices contain only an unrelated random event key; no room/player identifiers or gameplay. Host departure closes the room. The five-minute cron removes expired/changed games and hosts inactive over three minutes. Operational counters expire after one day.
- /account/games/ provides own save download/deletion and room leave. Account JSON and content ZIP exports include only the owner’s saves/participation. Account deletion removes these records and closes hosted rooms without deleting other players’ persistent saves. Manual backup retention remains 30 days.

## Deployment sequence

The operator confirmed a current backup and authorised production publication on 19 October 2026.

1. Preserve existing migration timestamp mappings. Apply only 20261019043825_interactive_uploads and 20261019050833_game_accounts_multiplayer, then 20261019054510_game_realtime_delete_privacy, recording each exact source once. Do not blind-push/repair historical migrations. Game services initially stay disabled.
2. Deploy fas-account-lifecycle with the updated export handler. Install supabase/ops/game-room-cleanup.sql without changing unrelated jobs. Verify grants, publication and security advisors.
3. Merge PR #60 after all checks pass. Existing main/Cloudflare integration deploys the website. Verify new public frozen policy bytes against account/policy-versions.json, existing games/tools, Studio, account/games and private/missing routes.
4. Apply the guarded game-features-2026-10-19-v1 policy transition, then enable private.game_services_config. Existing players/contributors review the new policies; no acceptance is invented. Do not create production test accounts/content.
5. Rollback: disable game_services_config, restore the previous frontend deployment/revert the release, retain additive schema and user data. Disable new types in studio_content_types if needed; never delete packages/saves or rewrite migration history.

## Verification

Automated regression tests cover PostgreSQL permissions/lifecycle, package and schema bounds, ZIP round trips/corruption, account binding, exported source execution and existing site behavior. Chromium checks exercise desktop/mobile upload workflows and sandbox isolation, plus both editable multiplayer starters in two local tabs. Hosted DEV tests use disposable confirmed accounts and verify private saves, forged-account rejection, room capacity, host-only state, real Realtime delivery and outsider RLS, leave/sign-out and complete fixture cleanup. No production fixtures are used.
