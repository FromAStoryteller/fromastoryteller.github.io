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
select set_config('fas.profile_cover',gen_random_uuid()::text,true),
  set_config('fas.profile_story',(select id::text from public.stories where slug='profile-fixture-'||current_setting('fas.profile_owner')),true);
insert into public.story_assets(id,story_id,object_path,alt_text,approved_at,approved_by) values
  (current_setting('fas.profile_cover')::uuid,current_setting('fas.profile_story')::uuid,
   current_setting('fas.profile_owner')||'/'||current_setting('fas.profile_story')||'/'||current_setting('fas.profile_cover')||'.png',
   'Cover description',now(),current_setting('fas.profile_owner')::uuid);
update public.stories set cover_asset_id=current_setting('fas.profile_cover')::uuid where id=current_setting('fas.profile_story')::uuid;

set local role anon;
do $$ declare payload jsonb; begin
  payload:=public.fas_public_profile(current_setting('fas.profile_public_key')::uuid);
  if payload is null or jsonb_array_length(payload->'stories')<>1 then raise exception 'Public profile/publication failure'; end if;
  if payload::text like '%PRIVATE DRAFT%' or payload::text like '%@%' or payload ? 'id' or payload ? 'created_at' or payload ? 'role' then raise exception 'Account details leaked'; end if;
  if exists(select 1 from public.profiles) then raise exception 'Raw account profiles exposed'; end if;
  if public.fas_public_profile(current_setting('fas.profile_viewer_key')::uuid) is not null then raise exception 'Viewer profile exposed'; end if;
  if public.fas_public_story('profile-draft-'||current_setting('fas.profile_owner')) is not null then raise exception 'Draft exposed'; end if;
  if payload#>>'{stories,0,cover,asset_id}'<>current_setting('fas.profile_cover') or payload#>>'{stories,0,cover,alt}'<>'Cover description'
    or (payload#>'{stories,0,cover}') ? 'object_path' then raise exception 'Cover projection failure'; end if;
end $$;
reset role;
update public.story_assets set approved_at=null,approved_by=null where id=current_setting('fas.profile_cover')::uuid;
set local role anon;
do $$ begin
  if public.fas_public_profile(current_setting('fas.profile_public_key')::uuid)#>'{stories,0,cover}'<>'null'::jsonb then raise exception 'Unapproved cover exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('fas.profile_other'),true);
set local role authenticated;
do $$ begin
  update public.stories set cover_asset_id=current_setting('fas.profile_cover')::uuid where slug='profile-draft-'||current_setting('fas.profile_owner');
  if found then raise exception 'Other author cover changed'; end if;
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
    update public.stories set cover_asset_id=current_setting('fas.profile_cover')::uuid where slug='profile-draft-'||current_setting('fas.profile_owner');
    raise exception 'Cross-story cover allowed';
  exception when raise_exception then if SQLERRM<>'Choose a cover image belonging to this story' then raise; end if; end;
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
select 'Passed: anonymous projections, viewer privacy, cross-user isolation, protected identity/roles, approved-only cover metadata and cross-story cover denial, current bylines, draft exclusion and closing-account hiding. All fixtures rolled back.' as profile_test_result;
