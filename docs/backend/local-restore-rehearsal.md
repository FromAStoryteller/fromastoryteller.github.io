# Isolated account lifecycle restore rehearsal

Completed 15 October 2026 using synthetic accounts/data only. This is a real local Auth/database/Storage rehearsal, not just SQL simulation. No hosted project or production data was modified.

## Evidence

- Source: existing local fas-community-v1, API 127.0.0.1:55321.
- Target: fresh fas-account-restore-rehearsal, API 127.0.0.1:55521, separate Docker containers/volumes. All seven current migrations applied successfully to its empty database.
- Three disposable identities: contributor to delete, another contributor and a moderator/admin fixture. Two owned stories (draft/published), a separate author's private control story, approved/private image originals and registration declarations.
- The snapshot included actual Auth users/identities, related app rows and exact original Storage bytes with SHA-256 checksums. The temporary snapshot file was AES-256-GCM encrypted; its random key stayed in process memory and was cleared at completion.
- After the source contributor was deleted through the current lifecycle handler using real Auth/Storage APIs, the current deletion ledger was preserved independently of the older snapshot.
- Target recovery installed that ledger before importing older Auth/app rows and originals. Roles for a deleted identity were deliberately not re-granted. Generated Auth columns were reconstructed by PostgreSQL rather than inserted explicitly.
- RLS/public image delivery denied restored deleted publications and bytes even before cleanup replay. Both image originals were separately re-read with matching SHA-256 hashes using the privileged restore operator.
- Maintenance replay removed the restored deleted identity, content, original bytes and registration declaration. Its old password sign-in was rejected. The other contributor could sign in with the restored Auth identity, read their exact private story/image, and retrieve the original registration timestamp.
- Both stacks' fixture rows/files were cleaned up. The encrypted temporary snapshot was removed. The empty target stack and its Docker volumes were removed after verifying its fixed project ID, absence of a hosted link and zero Auth identities. The normal preview stack was left running.

## Scope and recovery rules

The harness calls the current lifecycle/image handlers with the two local service configurations; their database/Auth/Storage operations use real local APIs. It does not test a deployed target Edge Function, a full hosted pg_dump import, hosted SMTP, provider disaster recovery or public cutover. Keep those separate from this evidence. It proves the deleted-account recovery path against synthetic data, not the integrity of Ryan's separate hosted backup archive.

Keep a real recovery target closed to public Auth and reads/writes until ledger replay and verification finish. Preserve the newest deletion ledger separately; never replace it with the older backup copy. Restored deleted identities must be removed before reopening Auth, even where RLS already hides their publications. Do not restore privileges for identities marked for deletion. Restore original bytes through the Storage API, not raw storage.objects rows. Review orphaned files/invites and all enabled feature stores in a real recovery.

## Repeat locally

Use only an empty disposable target. From an operator directory outside the repository, copy supabase/config.toml, migrations, templates and seed.sql into a sibling account-restore-target/supabase directory. Change project_id to fas-account-restore-rehearsal, ports 55320–55329 to 55520–55529, and inspector_port 8083 to 8085. Do not copy a hosted project link, credentials, Auth backups or .temp files. Keep the same local email capture and redirect settings.

Check the CLI help, then start from that target directory with pinned CLI 2.120.0, excluding realtime,studio,logflare,vector,supavisor,imgproxy,edge-runtime. Capture startup output privately because it includes local keys. The source stack must already run normally.

From the source checkout set FAS_TEST_CONFIRM=LOCAL-FAS-RESTORE-ONLY in the current process, then run npm run test:restore:local. The script refuses remote URLs, hosted links, mismatched project IDs and a non-empty target. It captures local keys in memory and never prints private fixtures. Remove the acknowledgement variable afterwards. On any failure inspect the named stage before retrying; do not reset the source stack.

When finished, verify the resolved target directory, exact project ID, no hosted link and zero Auth users before stopping only fas-account-restore-rehearsal with --no-backup. This removes only disposable test volumes. Never use --all or --no-backup against the source or a hosted environment.
