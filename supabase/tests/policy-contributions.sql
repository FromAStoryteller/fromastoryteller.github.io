begin;
insert into auth.users(id,email,email_confirmed_at) values('52000000-0000-4000-8000-000000000001','policy-contributor@example.invalid',now());
insert into auth.sessions(id,user_id) values('53000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001');
insert into public.user_roles(user_id,role) values('52000000-0000-4000-8000-000000000001','member');
insert into public.stories(id,author_id,slug,title,body) values('54000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','policy-owned-read','Existing draft','Original private content');
insert into private.account_policy_releases(release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path)
 values('sql-contribution-test','published',now(),'terms-test','privacy-test',repeat('a',64),repeat('b',64),'/account/policy-history/sql-contribution-test/terms/','/account/policy-history/sql-contribution-test/privacy/');
update private.account_policy_requirement set release_id='sql-contribution-test';
set local role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"53000000-0000-4000-8000-000000000001"}',true);
do $$ begin
 if private.is_member() then raise exception 'FAIL missing agreement permits contribution'; end if;
 if not exists(select 1 from public.stories where id='54000000-0000-4000-8000-000000000001') then raise exception 'FAIL agreement blocks owned read'; end if;
 update public.profiles set bio='Correction remains available' where id=auth.uid();
 if not found then raise exception 'FAIL agreement blocks profile correction'; end if;
 if public.fas_my_policy_agreements()<>'[]'::jsonb then raise exception 'FAIL agreement backfilled'; end if;
 begin
  insert into public.stories(author_id,slug,title,body) values(auth.uid(),'policy-gate-denied','Denied','Synthetic');
  raise exception 'FAIL missing agreement permits story write';
 exception when insufficient_privilege then null; end;
 perform public.fas_accept_current_policies('sql-contribution-test',true,true,true);
 if not private.is_member() then raise exception 'FAIL explicit agreement does not restore contribution'; end if;
 insert into public.stories(author_id,slug,title,body) values(auth.uid(),'policy-gate-allowed','Allowed','Synthetic');
end $$;
rollback;
