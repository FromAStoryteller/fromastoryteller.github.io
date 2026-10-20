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
  if current_required is null or current_required not in ('game-features-2026-10-19-v1','studio-history-2026-10-20-v1') then
    raise exception 'Another policy release is required; review a separate transition';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='game-features-2026-10-19-v1'
    and status='published' and published_at<=now()
    and terms_sha256='236cd5e08e965f9265d423a259343f30c8a8f2f7f77617457957e4d78ef1e738'
    and privacy_sha256='b5e4a9cc86bd6cceb1bf7f5b57ad7d067bd4241a0be39c47e49573c0358947a4') then
    raise exception 'Published predecessor does not match the reviewed history';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='studio-history-2026-10-20-v1') then
    insert into private.account_policy_releases
      (release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age)
    values ('studio-history-2026-10-20-v1','published',now(),'studio-history-2026-10-20-v1','studio-history-2026-10-20-v1',
      '85bbf23711d7f10293568672b77e28604b9e993d4018f031435d7f1befb9668b','40b0e9d1b82880b11059d89c84d50a6b61799bc58ba47c128884098110f29fe3',
      '/account/policy-history/studio-history-2026-10-20-v1/terms/',
      '/account/policy-history/studio-history-2026-10-20-v1/privacy/',16);
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='studio-history-2026-10-20-v1'
    and status='published' and published_at<=now()
    and terms_version='studio-history-2026-10-20-v1' and privacy_version='studio-history-2026-10-20-v1'
    and terms_sha256='85bbf23711d7f10293568672b77e28604b9e993d4018f031435d7f1befb9668b' and privacy_sha256='40b0e9d1b82880b11059d89c84d50a6b61799bc58ba47c128884098110f29fe3'
    and terms_path='/account/policy-history/studio-history-2026-10-20-v1/terms/'
    and privacy_path='/account/policy-history/studio-history-2026-10-20-v1/privacy/' and minimum_age=16) then
    raise exception 'Stored release differs from the reviewed snapshots';
  end if;
  update private.account_policy_requirement set release_id='studio-history-2026-10-20-v1' where singleton;
end $fas_release$;
commit;
