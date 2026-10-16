-- Run only against FAS development. All synthetic accounts/content roll back.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
select set_config('fas.profile_owner',gen_random_uuid()::text,true),
  set_config('fas.profile_other',gen_random_uuid()::text,true),
  set_config('fas.profile_viewer',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at)
  select current_setting(k)::uuid,'fas-profile-fixture-'||current_setting(k)||'@example.invalid',now()
  from unnest(array['fas.profile_owner','fas.profile_other','fas.profile_viewer']) k;
insert into public.user_roles(user_id,role) values
  (current_setting('fas.profile_owner')::uuid,'member'),(current_setting('fas.profile_other')::uuid,'member');
update public.profiles set display_name='Profile fixture',bio='Public bio',welcome_line='Welcome'
  where id=current_setting('fas.profile_owner')::uuid;
select set_config('fas.profile_public_key',(select public_id::text from public.profiles where id=current_setting('fas.profile_owner')::uuid),true),
  set_config('fas.profile_viewer_key',(select public_id::text from public.profiles where id=current_setting('fas.profile_viewer')::uuid),true);
insert into public.stories(author_id,slug,title,body,status,published_at) values
  (current_setting('fas.profile_owner')::uuid,'profile-fixture-'||current_setting('fas.profile_owner'),'Published fixture','Public prose','published',now()),
  (current_setting('fas.profile_owner')::uuid,'profile-draft-'||current_setting('fas.profile_owner'),'Private fixture','PRIVATE DRAFT','draft',null);

set local role anon;
do $$ declare payload jsonb; begin
  payload:=public.fas_public_profile(current_setting('fas.profile_public_key')::uuid);
  if payload is null or jsonb_array_length(payload->'stories')<>1 then raise exception 'Public profile/publication failure'; end if;
  if payload::text like '%PRIVATE DRAFT%' or payload::text like '%@%' or payload ? 'id' or payload ? 'created_at' or payload ? 'role' then raise exception 'Account details leaked'; end if;
  if exists(select 1 from public.profiles) then raise exception 'Raw account profiles exposed'; end if;
  if public.fas_public_profile(current_setting('fas.profile_viewer_key')::uuid) is not null then raise exception 'Viewer profile exposed'; end if;
  if public.fas_public_story('profile-draft-'||current_setting('fas.profile_owner')) is not null then raise exception 'Draft exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('fas.profile_other'),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.profiles where id=current_setting('fas.profile_owner')::uuid) then raise exception 'Other private profile exposed'; end if;
  update public.profiles set bio='Tampered' where id=current_setting('fas.profile_owner')::uuid;
  if found then raise exception 'Other profile changed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('fas.profile_owner'),true);
set local role authenticated;
update public.profiles set display_name='New fixture pen name',welcome_line='New welcome' where id=current_setting('fas.profile_owner')::uuid;
do $$ begin
  begin
    update public.profiles set public_id=gen_random_uuid() where id=current_setting('fas.profile_owner')::uuid;
    raise exception 'Public identity changed';
  exception when insufficient_privilege then null; end;
  begin
    update public.user_roles set role='admin' where user_id=current_setting('fas.profile_owner')::uuid;
    if found then raise exception 'Role promotion allowed'; end if;
  exception when insufficient_privilege then null; end;
  if public.fas_public_story('profile-fixture-'||current_setting('fas.profile_owner'))#>>'{author,display_name}'<>'New fixture pen name' then raise exception 'Byline not updated'; end if;
  if public.fas_public_story('profile-draft-'||current_setting('fas.profile_owner')) is not null then raise exception 'Owner draft exposed through public endpoint'; end if;
end $$;
reset role;
insert into private.account_deletion_jobs(user_id,receipt_hash) values(current_setting('fas.profile_owner')::uuid,repeat('a',64));
set local role anon;
do $$ begin
  if public.fas_public_profile(current_setting('fas.profile_public_key')::uuid) is not null
    or public.fas_public_story('profile-fixture-'||current_setting('fas.profile_owner')) is not null then raise exception 'Closing account remained public'; end if;
end $$;
reset role;
rollback;
select 'Passed: anonymous projections, viewer privacy, cross-user isolation, protected identity/roles, current bylines, draft exclusion and closing-account hiding. All fixtures rolled back.' as profile_test_result;
