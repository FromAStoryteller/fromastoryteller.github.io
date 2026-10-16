-- PREPARED ONLY: execute after explicit publication approval and verification
-- of the exact public snapshot bytes on https://fromastoryteller.com.
-- Keep Auth signup OFF throughout this transaction. No user agreement is inserted.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';
do $fas_release$
declare current_required text;
begin
  select release_id into current_required from private.account_policy_requirement
    where singleton for update;
  if not found then raise exception 'Policy requirement singleton is missing'; end if;
  if current_required is not null and current_required <> 'account-launch-2026-10-16-v1' then
    raise exception 'Another policy release is required; review a separate transition';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='account-launch-2026-10-16-v1') then
    insert into private.account_policy_releases
      (release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age)
    values ('account-launch-2026-10-16-v1','published',now(),'account-launch-2026-10-16-v1','account-launch-2026-10-16-v1',
      'e99ebe4a36ea013f0bbb6216cf7f21e73f0d564e2c7f689beb449600b0124256','ebce6edbab0217a6eaee1f4ffb7b57efcdea288b26ed2e05266b4796627613bd',
      '/account/policy-history/account-launch-2026-10-16-v1/terms/',
      '/account/policy-history/account-launch-2026-10-16-v1/privacy/',16);
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='account-launch-2026-10-16-v1'
    and status='published' and published_at<=now()
    and terms_version='account-launch-2026-10-16-v1' and privacy_version='account-launch-2026-10-16-v1'
    and terms_sha256='e99ebe4a36ea013f0bbb6216cf7f21e73f0d564e2c7f689beb449600b0124256' and privacy_sha256='ebce6edbab0217a6eaee1f4ffb7b57efcdea288b26ed2e05266b4796627613bd'
    and terms_path='/account/policy-history/account-launch-2026-10-16-v1/terms/'
    and privacy_path='/account/policy-history/account-launch-2026-10-16-v1/privacy/' and minimum_age=16) then
    raise exception 'Stored release differs from the reviewed snapshots';
  end if;
  update private.account_policy_requirement set release_id='account-launch-2026-10-16-v1' where singleton;
end $fas_release$;
commit;
