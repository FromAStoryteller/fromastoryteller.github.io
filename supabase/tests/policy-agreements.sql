begin;
do $$ begin
 if public.fas_current_policy_requirement() is not null then raise exception 'FAIL agreement activated during install'; end if;
 if has_function_privilege('anon','public.fas_my_policy_agreements()','execute')
   or has_function_privilege('anon','public.fas_accept_current_policies(text,boolean,boolean,boolean)','execute') then raise exception 'FAIL anonymous agreement access'; end if;
end $$;
insert into auth.users(id,email,email_confirmed_at) values
 ('50000000-0000-4000-8000-000000000001','policy-owner@example.invalid',now()),
 ('50000000-0000-4000-8000-000000000002','policy-other@example.invalid',now()),
 ('50000000-0000-4000-8000-000000000003','policy-unverified@example.invalid',null);
insert into auth.sessions(id,user_id) values
 ('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'),
 ('51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003');
insert into private.account_policy_releases(release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path)
 values ('sql-test-published','published',now(),'sql-terms-v1','sql-privacy-v1',repeat('a',64),repeat('b',64),'/account/policy-history/sql-test-published/terms/','/account/policy-history/sql-test-published/privacy/'),
 ('sql-test-review','review',null,'review','review',repeat('c',64),repeat('d',64),'/account/policy-history/sql-test-review/terms/','/account/policy-history/sql-test-review/privacy/');
update private.account_policy_requirement set release_id='sql-test-review';
do $$ begin
 if public.fas_before_user_created('{}')->'error' is null then raise exception 'FAIL review release accepted'; end if;
 begin perform public.fas_current_policy_requirement(); raise exception 'FAIL unpublished requirement exposed';
 exception when raise_exception then if sqlerrm='FAIL unpublished requirement exposed' then raise; end if; end;
end $$;
update private.account_policy_requirement set release_id='sql-test-published';
do $$ declare event jsonb; begin
 event:=jsonb_build_object('user',jsonb_build_object('user_metadata',jsonb_build_object('fas_policy_agreement',jsonb_build_object(
 'mode','published_terms_agreement','release_id','sql-test-published','terms_version','sql-terms-v1','privacy_version','sql-privacy-v1',
 'terms_sha256',repeat('a',64),'privacy_sha256',repeat('b',64),'terms_agreed',true,'privacy_notice_seen',true,'age_16_or_over',true))));
 if public.fas_before_user_created(event)<>'{}'::jsonb then raise exception 'FAIL valid published agreement denied'; end if;
 if public.fas_before_user_created('{}')->'error' is null then raise exception 'FAIL missing agreement accepted'; end if;
 if public.fas_before_user_created(jsonb_set(event,'{user,user_metadata,fas_policy_agreement,terms_agreed}','"true"'))->'error' is null then raise exception 'FAIL string agreement accepted'; end if;
 if public.fas_before_user_created(jsonb_set(event,'{user,user_metadata,fas_policy_agreement,privacy_notice_seen}','false'))->'error' is null then raise exception 'FAIL privacy notice unchecked'; end if;
 if public.fas_before_user_created(jsonb_set(event,'{user,user_metadata,fas_policy_agreement,age_16_or_over}','false'))->'error' is null then raise exception 'FAIL missing age declaration'; end if;
 if public.fas_before_user_created(jsonb_set(event,'{user,user_metadata,fas_policy_agreement,terms_sha256}','"forged"'))->'error' is null then raise exception 'FAIL wrong document accepted'; end if;
 if public.fas_before_user_created(jsonb_set(event,'{user,user_metadata,fas_policy_agreement,release_id}','"stale"'))->'error' is null then raise exception 'FAIL stale release accepted'; end if;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('50000000-0000-4000-8000-000000000004','policy-signup@example.invalid',now(),event->'user'->'user_metadata');
end $$;
update auth.users set raw_user_meta_data='{}' where id='50000000-0000-4000-8000-000000000004';
do $$ begin
 if not exists(select 1 from private.account_policy_agreements where user_id='50000000-0000-4000-8000-000000000004' and source='signup') then raise exception 'FAIL original signup agreement lost'; end if;
 if exists(select 1 from private.account_policy_agreements where user_id='50000000-0000-4000-8000-000000000002') then raise exception 'FAIL existing identity silently accepted'; end if;
 begin update private.account_policy_releases set terms_version='tampered'; raise exception 'FAIL editable policy release';
 exception when raise_exception then if sqlerrm='FAIL editable policy release' then raise; end if; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"51000000-0000-4000-8000-000000000001"}',true);
do $$ declare original jsonb; begin
 if public.fas_my_policy_agreements()<>'[]'::jsonb then raise exception 'FAIL another identity visible'; end if;
 begin perform public.fas_accept_current_policies('sql-test-published',false,true,true); raise exception 'FAIL no agreement accepted';
 exception when raise_exception then if sqlerrm='FAIL no agreement accepted' then raise; end if; end;
 begin perform public.fas_accept_current_policies('stale',true,true,true); raise exception 'FAIL old release accepted';
 exception when raise_exception then if sqlerrm='FAIL old release accepted' then raise; end if; end;
 original:=public.fas_accept_current_policies('sql-test-published',true,true,true);
 if jsonb_array_length(original)<>1 or original->0->>'source'<>'existing_account' then raise exception 'FAIL self acceptance'; end if;
 if public.fas_accept_current_policies('sql-test-published',true,true,true)<>original then raise exception 'FAIL repeat overwrites record'; end if;
 begin update private.account_policy_agreements set recorded_at=now(); raise exception 'FAIL browser update allowed';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.user_roles where user_id=auth.uid()) then raise exception 'FAIL agreement grants privilege'; end if;
end $$;
select set_config('request.jwt.claims','{"session_id":"51000000-0000-4000-8000-000000000002"}',true);
do $$ begin
 begin perform public.fas_accept_current_policies('sql-test-published',true,true,true); raise exception 'FAIL other session accepted';
 exception when raise_exception then if sqlerrm='FAIL other session accepted' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
do $$ begin
 begin perform public.fas_accept_current_policies('sql-test-published',true,true,true); raise exception 'FAIL unverified identity accepted';
 exception when raise_exception then if sqlerrm='FAIL unverified identity accepted' then raise; end if; end;
end $$;
reset role;
delete from auth.sessions where user_id='50000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"51000000-0000-4000-8000-000000000001"}',true);
do $$ begin
 begin perform public.fas_accept_current_policies('sql-test-published',true,true,true); raise exception 'FAIL revoked session accepted';
 exception when raise_exception then if sqlerrm='FAIL revoked session accepted' then raise; end if; end;
end $$;
reset role;
delete from auth.users where id='50000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from private.account_policy_agreements where user_id='50000000-0000-4000-8000-000000000001') then raise exception 'FAIL agreement retained after deletion'; end if;
end $$;
rollback;
