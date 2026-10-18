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
  if current_required is null or current_required not in ('account-sessions-2026-10-16-v2','community-policies-2026-10-18-v1') then
    raise exception 'Another policy release is required; review a separate transition';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='account-sessions-2026-10-16-v2'
    and status='published' and published_at<=now()
    and terms_sha256='ef073fb0cec368be3e4a3458aa388eac86c2ab88ee3e3cc36238792ce65c3129'
    and privacy_sha256='9d49ffa067b09f2b1ad6cdd7c2fe42079b7d92bc7fffe6f02b8abd626a72e8d7') then
    raise exception 'Published predecessor does not match the reviewed history';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='community-policies-2026-10-18-v1') then
    insert into private.account_policy_releases
      (release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age)
    values ('community-policies-2026-10-18-v1','published',now(),'community-policies-2026-10-18-v1','community-policies-2026-10-18-v1',
      'f0bf19cfcbc6b2b67016efa34367f9a8ca76678d36675d8f396059f725fd6bdf','5df51966e047ae11db4083b7c9afc8f19f36df369b20d6f95024a5a56fa4c803',
      '/account/policy-history/community-policies-2026-10-18-v1/terms/',
      '/account/policy-history/community-policies-2026-10-18-v1/privacy/',16);
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='community-policies-2026-10-18-v1'
    and status='published' and published_at<=now()
    and terms_version='community-policies-2026-10-18-v1' and privacy_version='community-policies-2026-10-18-v1'
    and terms_sha256='f0bf19cfcbc6b2b67016efa34367f9a8ca76678d36675d8f396059f725fd6bdf' and privacy_sha256='5df51966e047ae11db4083b7c9afc8f19f36df369b20d6f95024a5a56fa4c803'
    and terms_path='/account/policy-history/community-policies-2026-10-18-v1/terms/'
    and privacy_path='/account/policy-history/community-policies-2026-10-18-v1/privacy/' and minimum_age=16) then
    raise exception 'Stored release differs from the reviewed snapshots';
  end if;
  update private.account_policy_requirement set release_id='community-policies-2026-10-18-v1' where singleton;
end $fas_release$;
commit;
