begin;
-- An author archive remains distinct from a staff moderation lock.
alter table public.stories add column author_archived_at timestamptz;
alter table public.stories add constraint story_author_archive_state check(author_archived_at is null or status='archived');
-- No client INSERT/UPDATE grant on this server-owned column.
create or replace function private.guard_story() returns trigger
language plpgsql set search_path = '' as $$ begin
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

-- Keep direct deletion limited to never-published unscheduled drafts. Previously
-- published work requires an explicit, version-checked archive/delete workflow.
alter policy stories_delete on public.stories using(author_id=(select auth.uid()) and (select private.is_member()) and status='draft' and not slug_locked and published_at is null and scheduled_at is null);
alter policy stories_delete_gate on public.stories using(author_id=(select auth.uid()) and (select private.is_member()) and status='draft' and not slug_locked and published_at is null and scheduled_at is null);

create function private.retain_deleted_story_address() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.slug_locked then
  perform pg_advisory_xact_lock(146389899);
  insert into private.studio_reserved_addresses(slug) values(old.slug) on conflict do nothing;
 end if;
 return old;
end;$$;
revoke all on function private.retain_deleted_story_address() from public,anon,authenticated;
create trigger fas_retain_deleted_story_address before delete on public.stories for each row execute function private.retain_deleted_story_address();

create function private.story_lifecycle(target_story uuid,expected_version timestamptz,action text,confirmation_title text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid; item public.stories;
begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if expected_version is null or action is null or action not in ('archive','restore','delete') then raise exception 'Invalid lifecycle request';end if;
 perform 1 from public.user_roles where user_id=caller and role='member' for share;
 if not found then raise exception 'Contributor access required';end if;
 select * into item from public.stories where id=target_story and author_id=caller for update;
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
revoke all on function private.story_lifecycle(uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function private.story_lifecycle(uuid,timestamptz,text,text) to authenticated;
create function public.fas_story_lifecycle(target_story uuid,expected_version timestamptz,action text,confirmation_title text default null) returns jsonb language sql security invoker set search_path='' as $$
 select private.story_lifecycle(target_story,expected_version,action,confirmation_title);
$$;
revoke all on function public.fas_story_lifecycle(uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.fas_story_lifecycle(uuid,timestamptz,text,text) to authenticated;

create or replace function public.moderate_story(target_story uuid, decision public.story_status, note text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.story_status; author_archive timestamptz;
begin
  perform private.require_operator_session();
  if not private.is_staff() then raise exception 'Moderator required'; end if;
  if note is null or char_length(btrim(note)) not between 1 and 2000 then raise exception 'Reason required'; end if;
  select status,author_archived_at into previous,author_archive from public.stories where id=target_story for update;
  if not found then raise exception 'Story not found'; end if;
  if decision is distinct from 'archived' or (previous = 'archived' and author_archive is null) then
    raise exception 'Staff may archive content for moderation; contributors publish their own work';
  end if;
  update public.stories set status='archived',author_archived_at=null,scheduled_at=null where id=target_story;
  insert into public.moderation_log(story_id,actor_id,from_status,to_status,reason)
    values(target_story,auth.uid(),previous,'archived',btrim(note));
  insert into private.admin_audit(actor_id,action,subject_id,details,reason) values(auth.uid(),'story_archived',target_story,jsonb_build_object('previous_status',previous),btrim(note));
end; $$;

create or replace function public.fas_my_studio_work(search_text text default '',type_filter text default '',state_filter text default '',before_time timestamptz default null,after_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid;result jsonb;cursor jsonb;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if search_text is null or char_length(search_text)>200 or type_filter is null or state_filter is null or state_filter not in ('','draft','scheduled','published','archived','moderation','needs-update') or (before_time is null)<>(after_id is null) then raise exception 'Invalid library filters';end if;
 with all_work as (
 select s.id,s.title,s.slug,s.status::text,s.published_at,s.slug_locked,s.updated_at,s.content_type,s.scheduled_at,s.metadata_version,private.studio_missing_metadata(s) as missing,(s.metadata_version>0 or s.status='published') and (s.metadata_version<c.metadata_version or cardinality(private.studio_missing_metadata(s))>0) as needs_metadata_update,s.publishing_identity,s.author_archived_at,'studio'::text as source_kind,null::text as url from public.stories s join public.studio_content_types c on c.id=s.content_type where s.author_id=caller
 union all select id,title,slug,'published',published_at,true,updated_at,content_type,null::timestamptz,0,'{}'::text[],false,publishing_identity,null::timestamptz,'file',url from private.file_content where owner_id=caller
 ), page as(select * from all_work where (search_text='' or position(lower(search_text) in lower(title))>0) and (type_filter='' or content_type=type_filter) and (state_filter='' or state_filter='scheduled' and scheduled_at is not null or state_filter='draft' and status='draft' and scheduled_at is null or state_filter in ('published','archived') and status=state_filter or state_filter='moderation' and status='archived' and author_archived_at is null or state_filter='needs-update' and needs_metadata_update) and (before_time is null or updated_at<before_time or updated_at=before_time and id>after_id) order by updated_at desc,id limit 21),
 limited as(select * from page order by updated_at desc,id limit 20)
 select coalesce(jsonb_agg((to_jsonb(limited)-'missing')||jsonb_build_object('missing_metadata',missing) order by updated_at desc,id),'[]'),
 case when(select count(*) from page)>20 then(select jsonb_build_object('updated_at',updated_at,'id',id) from limited order by updated_at asc,id desc limit 1) else null end into result,cursor from limited;
 return jsonb_build_object('items',result,'next_cursor',cursor);
end;$$;
notify pgrst,'reload schema';
commit;
