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
  if current_required is null or current_required not in ('account-launch-2026-10-16-v1','account-sessions-2026-10-16-v2') then
    raise exception 'Another policy release is required; review a separate transition';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='account-launch-2026-10-16-v1'
    and status='published' and published_at<=now()
    and terms_sha256='e99ebe4a36ea013f0bbb6216cf7f21e73f0d564e2c7f689beb449600b0124256'
    and privacy_sha256='ebce6edbab0217a6eaee1f4ffb7b57efcdea288b26ed2e05266b4796627613bd') then
    raise exception 'Published predecessor does not match the reviewed history';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='account-sessions-2026-10-16-v2') then
    insert into private.account_policy_releases
      (release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age)
    values ('account-sessions-2026-10-16-v2','published',now(),'account-sessions-2026-10-16-v2','account-sessions-2026-10-16-v2',
      'ef073fb0cec368be3e4a3458aa388eac86c2ab88ee3e3cc36238792ce65c3129','9d49ffa067b09f2b1ad6cdd7c2fe42079b7d92bc7fffe6f02b8abd626a72e8d7',
      '/account/policy-history/account-sessions-2026-10-16-v2/terms/',
      '/account/policy-history/account-sessions-2026-10-16-v2/privacy/',16);
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='account-sessions-2026-10-16-v2'
    and status='published' and published_at<=now()
    and terms_version='account-sessions-2026-10-16-v2' and privacy_version='account-sessions-2026-10-16-v2'
    and terms_sha256='ef073fb0cec368be3e4a3458aa388eac86c2ab88ee3e3cc36238792ce65c3129' and privacy_sha256='9d49ffa067b09f2b1ad6cdd7c2fe42079b7d92bc7fffe6f02b8abd626a72e8d7'
    and terms_path='/account/policy-history/account-sessions-2026-10-16-v2/terms/'
    and privacy_path='/account/policy-history/account-sessions-2026-10-16-v2/privacy/' and minimum_age=16) then
    raise exception 'Stored release differs from the reviewed snapshots';
  end if;
  update private.account_policy_requirement set release_id='account-sessions-2026-10-16-v2' where singleton;
end $fas_release$;
commit;
