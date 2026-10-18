-- Synthetic identities only; runs inside a rollback in both PostgreSQL and DEV.
begin;
update private.account_policy_requirement set release_id=null where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('ca000000-0000-0000-0000-000000000001','policy-admin@example.invalid',now(),'{}'),
 ('ca000000-0000-0000-0000-000000000002','policy-writer@example.invalid',now(),'{}');
insert into public.user_roles(user_id,role) values('ca000000-0000-0000-0000-000000000001','admin');
insert into auth.sessions(id,user_id) values
 ('cb000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001'),
 ('cb000000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','ca000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"cb000000-0000-0000-0000-000000000001"}',true);
select set_config('fas.policy_fixture.invite',public.create_invite('policy-writer@example.invalid',7),true);
reset role;
insert into private.account_policy_releases(release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path,minimum_age)
 values('community-policy-fixture','published',now(),'community-policy-fixture','community-policy-fixture',repeat('a',64),repeat('b',64),'/account/policy-history/community-policy-fixture/terms/','/account/policy-history/community-policy-fixture/privacy/',16);
update private.account_policy_requirement set release_id='community-policy-fixture' where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub','ca000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"cb000000-0000-0000-0000-000000000002"}',true);
do $$begin
 begin perform public.accept_invite(current_setting('fas.policy_fixture.invite'));raise exception 'FAIL no agreement allowed invitation';exception when raise_exception then if SQLERRM<>'Review the current account and contributor policies' then raise;end if;end;
 if exists(select 1 from public.user_roles where user_id=auth.uid()) then raise exception 'FAIL invitation denial changed roles';end if;
 begin perform public.fas_accept_current_policies('earlier-version',true,true,true);raise exception 'FAIL stale agreement';exception when raise_exception then if SQLERRM<>'Review the current published policies and required confirmations' then raise;end if;end;
 begin perform public.fas_accept_current_policies('community-policy-fixture',false,true,true);raise exception 'FAIL unchecked agreement';exception when raise_exception then if SQLERRM<>'Review the current published policies and required confirmations' then raise;end if;end;
 perform public.fas_accept_current_policies('community-policy-fixture',true,true,true);
 perform public.accept_invite(current_setting('fas.policy_fixture.invite'));
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='member') or exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') then raise exception 'FAIL incorrect accepted roles';end if;
 if jsonb_array_length(public.fas_my_policy_agreements())<>1 then raise exception 'FAIL missing agreement';end if;
 perform public.fas_accept_current_policies('community-policy-fixture',true,true,true);
 if jsonb_array_length(public.fas_my_policy_agreements())<>1 then raise exception 'FAIL duplicated agreement';end if;
end;$$;
reset role;
-- Existing contribution gate must reject direct writes without current agreement,
-- even for an independently granted contributor role.
insert into public.user_roles(user_id,role) values('ca000000-0000-0000-0000-000000000001','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','ca000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"cb000000-0000-0000-0000-000000000001"}',true);
do $$begin
 if private.current_policies_accepted(auth.uid()) then raise exception 'FAIL role inferred agreement';end if;
 begin insert into public.stories(author_id,slug,title,body) values(auth.uid(),'policy-fixture-denied','Fixture','Text');raise exception 'FAIL write without agreement';exception when insufficient_privilege then null;end;
 if public.fas_my_policy_agreements()<>'[]'::jsonb then raise exception 'FAIL acceptance copied from another account';end if;
end;$$;
reset role;
rollback;
