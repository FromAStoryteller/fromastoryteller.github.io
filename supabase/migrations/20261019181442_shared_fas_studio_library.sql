begin;

-- Shared FAS editing preserves the original author, URL and public attribution.
create function private.can_edit_studio_content(owner_key uuid,identity_key text,actor_key uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_active(actor_key) and private.current_policies_accepted(actor_key)
 and exists(select 1 from public.user_roles where user_id=actor_key and role='member')
 and (owner_key=actor_key or identity_key='fas' and exists(select 1 from public.user_roles where user_id=actor_key and role='admin'));
$$;
revoke all on function private.can_edit_studio_content(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.can_edit_studio_content(uuid,text,uuid) to authenticated,service_role;
alter policy stories_edit on public.stories using(private.can_edit_studio_content(author_id,publishing_identity,(select auth.uid())) and status<>'archived') with check(private.can_edit_studio_content(author_id,publishing_identity,(select auth.uid())) and status in ('draft','published'));
alter policy stories_update_gate on public.stories using(private.can_edit_studio_content(author_id,publishing_identity,(select auth.uid())) and status<>'archived') with check(private.can_edit_studio_content(author_id,publishing_identity,(select auth.uid())) and status in ('draft','published'));


create function private.authorize_shared_fas_write(owner_key uuid,identity_key text) returns void language plpgsql security definer set search_path='' as $$declare caller uuid;begin
 caller:=private.require_operator_session();
 if identity_key<>'fas' or not private.can_edit_studio_content(owner_key,identity_key,caller) then raise exception 'Shared FAS access required';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
end;$$;
revoke all on function private.authorize_shared_fas_write(uuid,text) from public,anon,authenticated;
grant execute on function private.authorize_shared_fas_write(uuid,text) to authenticated;

create or replace function private.guard_story() returns trigger
language plpgsql set search_path = '' as $$ begin
  if current_user='authenticated' and new.author_id is distinct from auth.uid() then
    if TG_OP<>'UPDATE' or old.publishing_identity<>'fas' or new.publishing_identity<>'fas' or not private.can_edit_studio_content(old.author_id,old.publishing_identity,auth.uid()) then raise exception 'Owned or shared FAS content required';end if;
    perform private.authorize_shared_fas_write(old.author_id,old.publishing_identity);
  end if;
  if TG_OP = 'UPDATE' then
    if new.id is distinct from old.id or new.author_id is distinct from old.author_id
      or new.created_at is distinct from old.created_at then
      raise exception 'Story identity is immutable';
    end if;
    if current_user = 'authenticated' and
      (old.status = 'archived' or new.status not in ('draft','published')) then
      raise exception 'Contributors may save drafts or publish their own unmoderated stories';
    end if;
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  elsif current_user = 'authenticated' and new.status <> 'draft' then
    raise exception 'New stories must be drafts';
  end if;
  if new.status <> 'archived' then new.author_archived_at := null; end if;
  -- Publication timestamps are server-owned; live edits preserve first publication.
  if current_user <> 'authenticated' and TG_OP='INSERT' then return new; end if;
  if new.status = 'published' then
    if TG_OP = 'UPDATE' and old.status = 'published' then
      new.published_at := old.published_at;
    else new.published_at := now(); end if;
  else new.published_at := null; end if;
  return new;
end; $$;

create function private.audit_shared_fas_edit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if current_setting('role',true)='authenticated' and auth.uid() is distinct from new.author_id and private.can_edit_studio_content(new.author_id,new.publishing_identity,auth.uid()) then
 insert into private.admin_audit(actor_id,action,subject_id,details,reason) values(auth.uid(),'fas_content_edited',new.id,jsonb_build_object('owner_id',new.author_id),'Administrator edited shared FAS content');end if;return new;end;$$;
revoke all on function private.audit_shared_fas_edit() from public,anon,authenticated;
create trigger fas_shared_edit_audit after update on public.stories for each row execute function private.audit_shared_fas_edit();

create or replace function private.studio_library(library_scope text,search_text text default '',type_filter text default '',state_filter text default '',before_time timestamptz default null,after_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid;result jsonb;cursor jsonb;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if library_scope is null or library_scope not in ('own','fas') or library_scope='fas' and not private.is_admin() then raise exception 'Administrator access required for FAS content';end if;
 if search_text is null or char_length(search_text)>200 or type_filter is null or state_filter is null or state_filter not in ('','draft','scheduled','published','archived','moderation','needs-update') or (before_time is null)<>(after_id is null) then raise exception 'Invalid library filters';end if;
 with all_work as (
 select s.id,s.title,s.slug,s.status::text,s.published_at,s.slug_locked,s.updated_at,s.content_type,s.scheduled_at,s.metadata_version,private.studio_missing_metadata(s) as missing,(s.metadata_version>0 or s.status='published') and (s.metadata_version<c.metadata_version or cardinality(private.studio_missing_metadata(s))>0) as needs_metadata_update,s.publishing_identity,s.author_archived_at,'studio'::text as source_kind,null::text as url from public.stories s join public.studio_content_types c on c.id=s.content_type where (library_scope='fas' and s.publishing_identity='fas' or library_scope='own' and s.author_id=caller and (not private.is_admin() or s.publishing_identity<>'fas'))
 union all select id,title,slug,'published',published_at,true,updated_at,content_type,null::timestamptz,0,'{}'::text[],false,publishing_identity,null::timestamptz,'file',url from private.file_content where not editorial_migrated and (library_scope='fas' and publishing_identity='fas' or library_scope='own' and owner_id=caller and (not private.is_admin() or publishing_identity<>'fas'))
 ), page as(select * from all_work where (search_text='' or position(lower(search_text) in lower(title))>0) and (type_filter='' or content_type=type_filter) and (state_filter='' or state_filter='scheduled' and scheduled_at is not null or state_filter='draft' and status='draft' and scheduled_at is null or state_filter in ('published','archived') and status=state_filter or state_filter='moderation' and status='archived' and author_archived_at is null or state_filter='needs-update' and needs_metadata_update) and (before_time is null or updated_at<before_time or updated_at=before_time and id>after_id) order by updated_at desc,id limit 21),
 limited as(select * from page order by updated_at desc,id limit 20)
 select coalesce(jsonb_agg((to_jsonb(limited)-'missing')||jsonb_build_object('missing_metadata',missing) order by updated_at desc,id),'[]'),
 case when(select count(*) from page)>20 then(select jsonb_build_object('updated_at',updated_at,'id',id) from limited order by updated_at asc,id desc limit 1) else null end into result,cursor from limited;
 return jsonb_build_object('items',result,'next_cursor',cursor);
end;$$;

create function public.fas_studio_library(library_scope text,search_text text default '',type_filter text default '',state_filter text default '',before_time timestamptz default null,after_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.studio_library(library_scope,search_text,type_filter,state_filter,before_time,after_id);$$;
revoke all on function private.studio_library(text,text,text,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function private.studio_library(text,text,text,text,timestamptz,uuid) to authenticated;

revoke all on function public.fas_studio_library(text,text,text,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.fas_studio_library(text,text,text,text,timestamptz,uuid) to authenticated;

create or replace function private.my_file_player(file_key uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid;item private.file_content;begin
 caller:=private.require_operator_session();if not private.is_member() then raise exception 'Contributor access required';end if;
 select * into item from private.file_content where id=file_key and private.can_edit_studio_content(owner_id,publishing_identity,caller) and content_type in ('game','tool');
 if not found then raise exception 'Content unavailable';end if;
 return jsonb_build_object('id',item.id,'version',item.updated_at,'package',(select executable_package from private.file_interactive_overrides where file_id=item.id and owner_id=item.owner_id));
end;$$;

create or replace function private.save_file_player(file_key uuid,expected_version timestamptz,player_package jsonb,identity_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;item private.file_content;begin
 caller:=private.require_operator_session();if not private.is_member() or not private.current_policies_accepted(caller) then raise exception 'Current contributor agreements required';end if;
 select * into item from private.file_content where id=file_key and private.can_edit_studio_content(owner_id,publishing_identity,caller) and content_type in ('game','tool') for update;
 if not found or item.updated_at is distinct from expected_version then raise exception 'Content changed or unavailable. Reopen it from Your work' using errcode='P0002';end if;
 if item.owner_id<>caller and identity_key is distinct from 'fas' then raise exception 'Shared FAS attribution is permanent for this editor';end if;
 if item.content_type='tool' then perform private.require_admin();end if;
 if identity_key is null or identity_key not in ('personal','fas') or item.content_type='tool' and identity_key<>'fas' or identity_key='fas' and not private.can_publish_as_fas(caller) then raise exception 'Publishing access required';end if;
 if player_package is null or not private.valid_interactive_package(player_package) or btrim(player_package->>'js')='' or (player_package->>'template') is distinct from item.slug then raise exception 'Upload the working project downloaded for this page';end if;
 -- Compatibility projects preserve the original local-only game contract. New
 -- account-enabled games use the separate Studio game runtime and schema.
 if coalesce((player_package->'settings'->>'saves')::boolean,false) or coalesce(player_package->'settings'->>'multiplayer','off')<>'off' then raise exception 'These existing players use local-only features. Create a Studio game for account saves or multiplayer';end if;
 insert into private.file_interactive_overrides(file_id,owner_id,executable_package) values(item.id,item.owner_id,player_package)
 on conflict(file_id) do update set owner_id=excluded.owner_id,executable_package=excluded.executable_package,updated_at=clock_timestamp();
 update private.file_content set publishing_identity=identity_key,updated_at=clock_timestamp() where id=item.id;
 return (select jsonb_build_object('id',id,'updated_at',updated_at,'publishing_identity',publishing_identity) from private.file_content where id=item.id);
end;$$;

create or replace function private.story_lifecycle(target_story uuid,expected_version timestamptz,action text,confirmation_title text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid; item public.stories;
begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if expected_version is null or action is null or action not in ('archive','restore','delete') then raise exception 'Invalid lifecycle request';end if;
 perform 1 from public.user_roles where user_id=caller and role='member' for share;
 if not found then raise exception 'Contributor access required';end if;
 select * into item from public.stories where id=target_story and private.can_edit_studio_content(author_id,publishing_identity,caller) for update;
 if not found or item.updated_at is distinct from expected_version then raise exception using errcode='P0002',message='Content changed or unavailable';end if;
 if action in ('archive','delete') and confirmation_title is distinct from item.title then raise exception 'Confirm the current title';end if;
 if action='archive' then
  if item.status not in ('draft','published') then raise exception 'Only unmoderated draft or published content can be archived';end if;
  update public.stories set status='archived',author_archived_at=clock_timestamp(),scheduled_at=null where id=item.id returning * into item;
 elsif action='restore' then
  if item.status<>'archived' or item.author_archived_at is null then raise exception 'Only your own archive can be restored here';end if;
  update public.stories set status='draft',author_archived_at=null,scheduled_at=null where id=item.id returning * into item;
 else
  if item.status<>'archived' or item.author_archived_at is null then raise exception 'Archive your content before deleting it';end if;
  delete from public.stories where id=item.id;
  return jsonb_build_object('id',item.id,'deleted',true);
 end if;
 return jsonb_build_object('id',item.id,'status',item.status,'author_archived_at',item.author_archived_at,'updated_at',item.updated_at,'published_at',item.published_at,'scheduled_at',item.scheduled_at,'slug_locked',item.slug_locked);
end;$$;

create or replace function private.change_cover_image(target_story uuid,asset_key uuid,expected_version timestamptz,image_alt text,remove_image boolean) returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;story public.stories;asset public.story_assets;begin
 caller:=private.require_operator_session();perform private.require_contributor_write(caller);
 select * into story from public.stories where id=target_story and private.can_edit_studio_content(author_id,publishing_identity,caller) and status<>'archived' for update;
 if story.id is null or story.updated_at is distinct from expected_version then raise exception 'Content changed; reopen before managing covers' using errcode='P0002';end if;
 select * into asset from public.story_assets where id=asset_key and story_id=target_story for update;
 if asset.id is null then raise exception 'Cover unavailable';end if;
 if remove_image is null then raise exception 'Action required';end if;
 if remove_image then
  if story.cover_asset_id=asset_key then raise exception 'Choose and save a replacement, or clear the draft selection, before removing this cover';end if;
  delete from public.story_assets where id=asset_key;
 else
  if char_length(btrim(image_alt)) not between 1 and 500 then raise exception 'Image description required';end if;
  update public.story_assets set alt_text=btrim(image_alt) where id=asset_key;
 end if;
 -- Image edits participate in optimistic versioning without changing content.
 update public.stories set updated_at=clock_timestamp() where id=target_story returning * into story;
 return to_jsonb(story)-'author_id';
end;$$;

create or replace function public.fas_begin_cover_upload(target_story uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_key uuid; attempts integer;
begin
 perform private.require_operator_session();
 perform private.require_contributor_write(auth.uid());
 select author_id into owner_key from public.stories where id=target_story and private.can_edit_studio_content(author_id,publishing_identity,auth.uid()) and status<>'archived' for update;
 if owner_key is null then raise exception 'Owned editable content required';end if;
 if (select count(*) from public.story_assets where story_id=target_story)>=20 then raise exception 'Cover limit reached for this content';end if;
 insert into private.studio_cover_limits(user_id,period,attempts) values(owner_key,date_trunc('hour',now()),1)
 on conflict(user_id) do update set period=excluded.period,attempts=case when studio_cover_limits.period=excluded.period then studio_cover_limits.attempts+1 else 1 end
 returning studio_cover_limits.attempts into attempts;
 if attempts>20 then raise exception 'Cover upload limit reached. Try again later';end if;
 return jsonb_build_object('author_id',owner_key,'editor_id',auth.uid(),'story_id',target_story);
end;$$;

create or replace function private.reserve_image_upload(owner_key uuid,session_key uuid,image_path text,image_kind text) returns boolean language plpgsql security definer set search_path='' as $$declare target_id uuid; story public.stories; stored_owner uuid:=owner_key;begin
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 perform private.require_account_session(owner_key,session_key);
 if not private.account_active(owner_key) or not private.current_policies_accepted(owner_key) then raise exception 'Active account required';end if;
 if image_kind not in ('cover','profile') or image_kind is null or image_path!~'^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$' then raise exception 'Invalid upload path';end if;
 target_id:=split_part(image_path,'/',2)::uuid;
 if image_kind='cover' then
  select * into story from public.stories where id=target_id and status<>'archived' for update;
  if not found or not private.can_edit_studio_content(story.author_id,story.publishing_identity,owner_key) then raise exception 'Owned editable content required';end if;stored_owner:=story.author_id;
 else
  if split_part(image_path,'/',1)<>owner_key::text or not exists(select 1 from public.profiles where id=owner_key and public_id=target_id) then raise exception 'Owned profile required';end if;
 end if;
 if split_part(image_path,'/',1)<>stored_owner::text then raise exception 'Invalid stored owner';end if;
 if exists(select 1 from private.image_cleanup where path=image_path) then raise exception 'Retired image path';end if;
 insert into private.image_uploads(path,owner_id,kind) values(image_path,stored_owner,image_kind);
 return true;
end;$$;

CREATE OR REPLACE FUNCTION public.fas_register_verified_cover(target_story uuid, owner_key uuid, session_key uuid, image_path text, image_alt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare asset public.story_assets;story public.stories;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 if not exists(select 1 from auth.sessions where id=session_key and user_id=owner_key and (not_after is null or not_after>now()))
 or not private.account_active(owner_key) or not private.current_policies_accepted(owner_key)
 or not exists(select 1 from public.user_roles where user_id=owner_key and role='member') then raise exception 'Active contributor session required';end if;
 select * into story from public.stories where id=target_story and status<>'archived' for update;
 if not found or not private.can_edit_studio_content(story.author_id,story.publishing_identity,owner_key) then raise exception 'Owned editable content required';end if;
 if image_path!~('^'||story.author_id::text||'/'||target_story::text||'/[a-f0-9-]+\.jpg$') or char_length(btrim(image_alt)) not between 1 and 500 then raise exception 'Invalid verified cover';end if;
 if (select count(*) from public.story_assets where story_id=target_story)>=20 then raise exception 'Cover limit reached';end if;
 update private.image_uploads set state='active' where path=image_path and owner_id=story.author_id and kind='cover' and state='pending';
 if not found then raise exception 'Upload expired or unavailable';end if;
 insert into public.story_assets(story_id,object_path,alt_text,pixel_width,pixel_height,verified_at) values(target_story,image_path,btrim(image_alt),1600,900,now()) returning * into asset;
 return jsonb_build_object('id',asset.id,'alt_text',asset.alt_text,'pixel_width',1600,'pixel_height',900,'verified_at',asset.verified_at,'approved_at',null);
end;$function$;

alter policy stories_delete on public.stories using(private.can_edit_studio_content(author_id,publishing_identity,(select auth.uid())) and status='draft' and not slug_locked and published_at is null and scheduled_at is null);
alter policy stories_delete_gate on public.stories using(private.can_edit_studio_content(author_id,publishing_identity,(select auth.uid())) and status='draft' and not slug_locked and published_at is null and scheduled_at is null);

notify pgrst,'reload schema';
commit;
