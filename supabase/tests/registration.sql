begin;
do $$ begin
  if has_function_privilege('anon','public.fas_before_user_created(jsonb)','execute') or has_function_privilege('authenticated','public.fas_before_user_created(jsonb)','execute') then raise exception 'FAIL exposed signup hook'; end if;
  if not has_function_privilege('supabase_auth_admin','public.fas_before_user_created(jsonb)','execute') then raise exception 'FAIL hook inaccessible to Auth'; end if;
  if has_function_privilege('anon','public.fas_my_registration_declaration()','execute') then raise exception 'FAIL anonymous declaration access'; end if;
end $$;
do $$ declare event jsonb; begin
  event := '{"user":{"user_metadata":{"fas_registration":{"mode":"local_draft_review","terms_version":"local-preview-2026-10-15-v1","privacy_version":"local-preview-2026-10-15-v1","age_16_or_over":true,"terms_acknowledged":true,"privacy_notice_seen":true}}}}';
  if public.fas_before_user_created(event) <> '{}'::jsonb then raise exception 'FAIL valid self declaration'; end if;
  if not(public.fas_before_user_created('{}')->'error' is not null) then raise exception 'FAIL missing declaration allowed'; end if;
  if public.fas_before_user_created(jsonb_set(event,'{user,user_metadata,fas_registration,age_16_or_over}','"true"')) -> 'error' is null then raise exception 'FAIL string boolean accepted'; end if;
  if public.fas_before_user_created(jsonb_set(event,'{user,user_metadata,fas_registration,terms_version}','"old"')) -> 'error' is null then raise exception 'FAIL stale version accepted'; end if;
  if public.fas_before_user_created(jsonb_set(event,'{user,user_metadata,fas_registration,terms_acknowledged}','false')) -> 'error' is null then raise exception 'FAIL no acknowledgement accepted'; end if;
end $$;
reset role;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('40000000-0000-0000-0000-000000000001','declaration-test@example.invalid',now(),'{"fas_registration":{"mode":"local_draft_review","terms_version":"local-preview-2026-10-15-v1","privacy_version":"local-preview-2026-10-15-v1","age_16_or_over":true,"terms_acknowledged":true,"privacy_notice_seen":true}}'),
('40000000-0000-0000-0000-000000000002','legacy-test@example.invalid',now(),'{}');
update auth.users set raw_user_meta_data='{"fas_registration":{"terms_version":"tampered","age_16_or_over":false}}' where id='40000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
do $$ declare record jsonb; begin
  record:=public.fas_my_registration_declaration();
  if record->>'terms_version'<>'local-preview-2026-10-15-v1' or record->>'recorded_at' is null or record->>'minimum_age'<>'16' then raise exception 'FAIL original registration record'; end if;
  begin
    update private.account_registration_declarations set minimum_age=13;
    raise exception 'FAIL writable declaration';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.user_roles where user_id=auth.uid()) then raise exception 'FAIL declaration grants privileges'; end if;
end $$;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000002',true);
do $$ begin if public.fas_my_registration_declaration() is not null then raise exception 'FAIL another account or fabricated legacy declaration'; end if; end $$;
reset role;
delete from auth.users where id='40000000-0000-0000-0000-000000000001';
do $$ begin if exists(select 1 from private.account_registration_declarations where user_id='40000000-0000-0000-0000-000000000001') then raise exception 'FAIL declaration retained after identity deletion'; end if; end $$;
rollback;
