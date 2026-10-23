-- PREPARED ONLY: execute after explicit publication approval and verification
-- of the exact public snapshot bytes on https://fromastoryteller.com.
-- Existing signup and agreement requests carry exact versions/hashes;
-- stale requests fail closed during this locked transition. No user agreement is inserted.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';
do $fas_release$
declare current_required text;
begin
  select release_id into current_required from private.account_policy_requirement
    where singleton for update;
  if not found then raise exception 'Policy requirement singleton is missing'; end if;
  if current_required is null or current_required not in ('viewer-actions-2026-10-20-v1','viewer-activity-2026-10-24-v1') then
    raise exception 'Another policy release is required; review a separate transition';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='viewer-actions-2026-10-20-v1'
    and status='published' and published_at<=now()
    and terms_sha256='6fbd0d3178796bccbaf1911ec28f860a336ce8768a27d1f9af490afc260a9e7b'
    and privacy_sha256='08b40fd2cd9e22c7a677e9b2570c3defbac4a2a9ba67396c2fbe8c7e8860b17d') then
    raise exception 'Published predecessor does not match the reviewed history';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='viewer-activity-2026-10-24-v1') then
    insert into private.account_policy_releases
      (release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age)
    values ('viewer-activity-2026-10-24-v1','published',now(),'viewer-activity-2026-10-24-v1','viewer-activity-2026-10-24-v1',
      'd33330c5f438bdee9c670148f49588daf903846e4efd84761b38ed8b3b1758ac','dce7a81c32523f5d08b27a2b1386375eb06dc9b878fefae404768592c022b27a',
      '/account/policy-history/viewer-activity-2026-10-24-v1/terms/',
      '/account/policy-history/viewer-activity-2026-10-24-v1/privacy/',16);
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='viewer-activity-2026-10-24-v1'
    and status='published' and published_at<=now()
    and terms_version='viewer-activity-2026-10-24-v1' and privacy_version='viewer-activity-2026-10-24-v1'
    and terms_sha256='d33330c5f438bdee9c670148f49588daf903846e4efd84761b38ed8b3b1758ac' and privacy_sha256='dce7a81c32523f5d08b27a2b1386375eb06dc9b878fefae404768592c022b27a'
    and terms_path='/account/policy-history/viewer-activity-2026-10-24-v1/terms/'
    and privacy_path='/account/policy-history/viewer-activity-2026-10-24-v1/privacy/' and minimum_age=16) then
    raise exception 'Stored release differs from the reviewed snapshots';
  end if;
  update private.account_policy_requirement set release_id='viewer-activity-2026-10-24-v1' where singleton;
end $fas_release$;
commit;
