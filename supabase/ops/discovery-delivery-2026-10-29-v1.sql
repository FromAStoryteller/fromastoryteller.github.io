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
  if current_required is null or current_required not in ('viewer-activity-default-2026-10-24-v1','discovery-delivery-2026-10-29-v1') then
    raise exception 'Another policy release is required; review a separate transition';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='viewer-activity-default-2026-10-24-v1'
    and status='published' and published_at<=now()
    and terms_sha256='6f8ca14a37d040a6803c4e232798d09ef782d7e543328189a85501c4e763814f'
    and privacy_sha256='9a1044a28cc3fbcf170e06054910276a168eaa4b1cb65b1417d93955e0590bb4') then
    raise exception 'Published predecessor does not match the reviewed history';
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='discovery-delivery-2026-10-29-v1') then
    insert into private.account_policy_releases
      (release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age)
    values ('discovery-delivery-2026-10-29-v1','published',now(),'discovery-delivery-2026-10-29-v1','discovery-delivery-2026-10-29-v1',
      '61d5d4241af8a23024572fb65b7b194fb5f09777c7f9d0e0e75645af62666dca','9d99619ef6fc9ed0aedd28c9db55eef6489e836f9a41ef6c3b8c5961b77cf7b5',
      '/account/policy-history/discovery-delivery-2026-10-29-v1/terms/',
      '/account/policy-history/discovery-delivery-2026-10-29-v1/privacy/',16);
  end if;
  if not exists(select 1 from private.account_policy_releases where release_id='discovery-delivery-2026-10-29-v1'
    and status='published' and published_at<=now()
    and terms_version='discovery-delivery-2026-10-29-v1' and privacy_version='discovery-delivery-2026-10-29-v1'
    and terms_sha256='61d5d4241af8a23024572fb65b7b194fb5f09777c7f9d0e0e75645af62666dca' and privacy_sha256='9d99619ef6fc9ed0aedd28c9db55eef6489e836f9a41ef6c3b8c5961b77cf7b5'
    and terms_path='/account/policy-history/discovery-delivery-2026-10-29-v1/terms/'
    and privacy_path='/account/policy-history/discovery-delivery-2026-10-29-v1/privacy/' and minimum_age=16) then
    raise exception 'Stored release differs from the reviewed snapshots';
  end if;
  update private.account_policy_requirement set release_id='discovery-delivery-2026-10-29-v1' where singleton;
end $fas_release$;
commit;
