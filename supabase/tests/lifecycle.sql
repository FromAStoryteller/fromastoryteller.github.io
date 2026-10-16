-- SQL-engine fixtures. Real Auth/Storage deletion is separately tested over local HTTP.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('30000000-0000-0000-0000-000000000001','lifecycle-owner@example.invalid',now()),
('30000000-0000-0000-0000-000000000002','lifecycle-other@example.invalid',now()),
('30000000-0000-0000-0000-000000000003','lifecycle-staff@example.invalid',now());
insert into public.user_roles values ('30000000-0000-0000-0000-000000000001','member'),('30000000-0000-0000-0000-000000000003','admin');
insert into auth.sessions(id,user_id) values ('30000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000001'),('30000000-0000-0000-0000-000000000013','30000000-0000-0000-0000-000000000003');
insert into public.stories(author_id,slug,title) values('30000000-0000-0000-0000-000000000001','lifecycle-owned','Owned');
do $$ declare function_name text; begin
  foreach function_name in array array['fas_account_snapshot(uuid,uuid)','fas_claim_account_action(uuid,uuid,text)','fas_prepare_account_deletion(uuid,uuid,text)','fas_begin_account_deletion(uuid,uuid,text)','fas_ack_account_files(uuid,text[])','fas_finish_account_deletion(uuid)','fas_account_deletion_status(uuid,text)','fas_purge_account_deletion_records()'] loop
    if has_function_privilege('anon','public.'||function_name,'execute') or has_function_privilege('authenticated','public.'||function_name,'execute') then raise exception 'FAIL exposed lifecycle function'; end if;
    if not has_function_privilege('service_role','public.'||function_name,'execute') then raise exception 'FAIL trusted workflow unavailable'; end if;
  end loop;
  begin
    perform public.fas_account_snapshot('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000011');
    raise exception 'FAIL mismatched identity/session';
  exception when raise_exception then if SQLERRM like 'FAIL%' then raise; end if; end;
  begin
    perform public.fas_prepare_account_deletion('30000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000013',repeat('a',64));
    raise exception 'FAIL staff deletion';
  exception when raise_exception then if SQLERRM like 'FAIL%' then raise; end if; end;
end $$;
do $$ begin
  for i in 1..5 loop
    if not public.fas_claim_account_action('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011','export') then raise exception 'FAIL premature rate limit'; end if;
  end loop;
  if public.fas_claim_account_action('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011','export') then raise exception 'FAIL rate limit missing'; end if;
end $$;
select public.fas_prepare_account_deletion('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011',repeat('a',64));
update private.account_deletion_intents set expires_at=now()-interval '1 second';
do $$ begin
  begin
    perform public.fas_begin_account_deletion('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011',repeat('a',64));
    raise exception 'FAIL expired confirmation';
  exception when raise_exception then if SQLERRM like 'FAIL%' then raise; end if; end;
end $$;
select public.fas_prepare_account_deletion('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011',repeat('a',64));
select public.fas_begin_account_deletion('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011',repeat('a',64));
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
do $$ begin
  if private.is_member() then raise exception 'FAIL closing contributor remains active'; end if;
  if public.fas_my_account_state()<>'closing' then raise exception 'FAIL closing status unavailable'; end if;
  update public.profiles set bio='Blocked' where id=auth.uid();
  if found then raise exception 'FAIL closing profile update'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.stories where author_id='30000000-0000-0000-0000-000000000001') then raise exception 'FAIL owned content retained'; end if;
  if not exists(select 1 from public.profiles where id='30000000-0000-0000-0000-000000000002') then raise exception 'FAIL other account removed'; end if;
end $$;
delete from auth.users where id='30000000-0000-0000-0000-000000000001';
select public.fas_finish_account_deletion('30000000-0000-0000-0000-000000000001');
-- A retained deletion ledger must hide a restored old published row immediately.
insert into auth.users(id,email,email_confirmed_at) values('30000000-0000-0000-0000-000000000001','lifecycle-restored@example.invalid',now());
insert into auth.sessions(id,user_id) values('30000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000001');
insert into public.stories(author_id,slug,title,status,published_at) values('30000000-0000-0000-0000-000000000001','lifecycle-restored','Restored old content','published',now());
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if exists(select 1 from public.stories where slug='lifecycle-restored') then raise exception 'FAIL restored deleted publication became public'; end if;
  if exists(select 1 from public.profiles where id='30000000-0000-0000-0000-000000000001') then raise exception 'FAIL restored deleted profile became public'; end if;
end $$;
reset role;
select public.fas_prepare_account_deletion('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011',repeat('a',64));
select public.fas_begin_account_deletion('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011',repeat('a',64));
do $$ begin if exists(select 1 from public.stories where slug='lifecycle-restored') then raise exception 'FAIL restore cleanup retry'; end if; end $$;
delete from auth.users where id='30000000-0000-0000-0000-000000000001';
select public.fas_finish_account_deletion('30000000-0000-0000-0000-000000000001');
do $$ begin
  if public.fas_account_deletion_status('30000000-0000-0000-0000-000000000001',repeat('a',64))<>'complete' then raise exception 'FAIL receipt status'; end if;
  if public.fas_account_deletion_status('30000000-0000-0000-0000-000000000002',repeat('a',64))<>'unknown' then raise exception 'FAIL receipt leaked'; end if;
end $$;
update private.account_deletion_jobs set completed_at=now()-interval '31 days';
select public.fas_purge_account_deletion_records();
do $$ begin if exists(select 1 from private.account_deletion_jobs) then raise exception 'FAIL completed receipt retention'; end if; end $$;
rollback;
