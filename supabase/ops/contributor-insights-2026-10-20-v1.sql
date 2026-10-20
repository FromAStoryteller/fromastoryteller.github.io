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
  if current_required is null or current_required not in ('studio-history-2026-10-20-v1','contributor-insights-2026-10-20-v1') then
    raise exception 'Another policy release is required; review a separate transition';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='studio-history-2026-10-20-v1'
    and status='published' and published_at<=now()
    and terms_sha256='85bbf23711d7f10293568672b77e28604b9e993d4018f031435d7f1befb9668b'
    and privacy_sha256='40b0e9d1b82880b11059d89c84d50a6b61799bc58ba47c128884098110f29fe3') then
    raise exception 'Published predecessor does not match the reviewed history';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='contributor-insights-2026-10-20-v1') then
    insert into private.account_policy_releases
      (release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age)
    values ('contributor-insights-2026-10-20-v1','published',now(),'contributor-insights-2026-10-20-v1','contributor-insights-2026-10-20-v1',
      '429913e852e7906cfbf8198be4c401fd37faf08d7997deb5ffe241f8e47cc2cd','31b2712121a167cd40b2c42d259a74a63de0d565b3f27c67d5ed1215ca9b2070',
      '/account/policy-history/contributor-insights-2026-10-20-v1/terms/',
      '/account/policy-history/contributor-insights-2026-10-20-v1/privacy/',16);
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='contributor-insights-2026-10-20-v1'
    and status='published' and published_at<=now()
    and terms_version='contributor-insights-2026-10-20-v1' and privacy_version='contributor-insights-2026-10-20-v1'
    and terms_sha256='429913e852e7906cfbf8198be4c401fd37faf08d7997deb5ffe241f8e47cc2cd' and privacy_sha256='31b2712121a167cd40b2c42d259a74a63de0d565b3f27c67d5ed1215ca9b2070'
    and terms_path='/account/policy-history/contributor-insights-2026-10-20-v1/terms/'
    and privacy_path='/account/policy-history/contributor-insights-2026-10-20-v1/privacy/' and minimum_age=16) then
    raise exception 'Stored release differs from the reviewed snapshots';
  end if;
  update private.account_policy_requirement set release_id='contributor-insights-2026-10-20-v1' where singleton;
end $fas_release$;
commit;
