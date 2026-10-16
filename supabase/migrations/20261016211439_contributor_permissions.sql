begin;
-- Contributors self-publish. 'archived' is reserved for staff moderation;
-- authors unpublish to draft and cannot reopen staff-archived content.
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
    new.updated_at := now();
  elsif current_user = 'authenticated' and new.status <> 'draft' then
    raise exception 'New stories must be drafts';
  end if;
  -- Publication timestamps are server-owned; live edits preserve first publication.
  if current_user <> 'authenticated' and TG_OP='INSERT' then return new; end if;
  if new.status = 'published' then
    if TG_OP = 'UPDATE' and old.status = 'published' then
      new.published_at := old.published_at;
    else new.published_at := now(); end if;
  else new.published_at := null; end if;
  return new;
end; $$;

alter policy stories_edit on public.stories using (
  author_id=(select auth.uid()) and (select private.is_member()) and status <> 'archived'
) with check (
  author_id=(select auth.uid()) and (select private.is_member()) and status in ('draft','published')
);
alter policy stories_update_gate on public.stories using (
  author_id=(select auth.uid()) and (select private.is_member()) and status <> 'archived'
) with check (
  author_id=(select auth.uid()) and (select private.is_member()) and status in ('draft','published')
);

-- Delete own text/metadata; private image bytes become unreachable immediately.
-- Preserve moderation history when the referenced story is removed.
alter table public.moderation_log alter column story_id drop not null;
alter table public.moderation_log drop constraint moderation_log_story_id_fkey;
alter table public.moderation_log add constraint moderation_log_story_id_fkey
  foreign key(story_id) references public.stories(id) on delete set null;
grant delete on public.stories to authenticated;
create policy stories_delete on public.stories for delete to authenticated
  using (author_id=(select auth.uid()) and (select private.is_member()));
create policy stories_delete_gate on public.stories as restrictive for delete to anon,authenticated
  using (author_id=(select auth.uid()) and (select private.is_member()));

create or replace function public.moderate_story(target_story uuid, decision public.story_status, note text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.story_status;
begin
  if not private.is_staff() then raise exception 'Moderator required'; end if;
  if note is null or char_length(btrim(note)) not between 1 and 2000 then raise exception 'Reason required'; end if;
  select status into previous from public.stories where id=target_story for update;
  if not found then raise exception 'Story not found'; end if;
  if decision <> 'archived' or previous = 'archived' then
    raise exception 'Staff may archive content for moderation; contributors publish their own work';
  end if;
  update public.stories set status='archived' where id=target_story;
  insert into public.moderation_log(story_id,actor_id,from_status,to_status,reason)
    values(target_story,auth.uid(),previous,'archived',btrim(note));
end; $$;

-- New unique image uploads are allowed while editing a published story too.
-- Existing bytes cannot be overwritten, moved or signed by a browser.
alter policy assets_create on public.story_assets with check (
  (select private.is_member()) and exists(select 1 from public.stories
    where id=story_id and author_id=(select auth.uid()) and status <> 'archived')
);
alter policy assets_edit on public.story_assets using (
  (select private.is_member()) and exists(select 1 from public.stories
    where id=story_id and author_id=(select auth.uid()) and status <> 'archived')
) with check (
  (select private.is_member()) and exists(select 1 from public.stories
    where id=story_id and author_id=(select auth.uid()) and status <> 'archived')
);
-- Restrictive guards protect metadata even if another permissive policy is added.
create policy assets_insert_gate on public.story_assets as restrictive for insert to authenticated
  with check ((select private.is_member()) and exists(select 1 from public.stories
    where id=story_id and author_id=(select auth.uid()) and status <> 'archived'));
create policy assets_update_gate on public.story_assets as restrictive for update to authenticated
  using ((select private.is_member()) and exists(select 1 from public.stories
    where id=story_id and author_id=(select auth.uid()) and status <> 'archived'))
  with check ((select private.is_member()) and exists(select 1 from public.stories
    where id=story_id and author_id=(select auth.uid()) and status <> 'archived'));

create or replace function private.guard_asset() returns trigger
language plpgsql set search_path = '' as $$
declare owner_id uuid; story_state public.story_status;
begin
  if TG_OP='UPDATE' and (new.id is distinct from old.id or new.story_id is distinct from old.story_id
    or new.object_path is distinct from old.object_path or new.created_at is distinct from old.created_at) then
    raise exception 'Asset identity is immutable';
  end if;
  select author_id,status into owner_id,story_state from public.stories where id=new.story_id for update;
  if not found then raise exception 'Story unavailable'; end if;
  if current_user='authenticated' and story_state='archived' then raise exception 'Story is archived by staff'; end if;
  if new.object_path !~ ('^'||owner_id::text||'/'||new.story_id::text||'/[a-f0-9-]+\.(jpg|jpeg|png|webp)$') then
    raise exception 'Use author UUID/story UUID/unique image filename';
  end if;
  return new;
end; $$;
alter policy fas_images_upload on storage.objects with check (
  bucket_id='fas-story-images' and (select private.is_member()) and exists(
    select 1 from public.stories s where s.author_id=(select auth.uid()) and s.status <> 'archived'
      and name ~ ('^'||s.author_id::text||'/'||s.id::text||'/[a-f0-9-]+\.(jpg|jpeg|png|webp)$'))
);
alter policy fas_images_insert_gate on storage.objects with check (
  bucket_id <> 'fas-story-images' or ((select private.is_member()) and exists(
    select 1 from public.stories s where s.author_id=(select auth.uid()) and s.status <> 'archived'
      and name ~ ('^'||s.author_id::text||'/'||s.id::text||'/[a-f0-9-]+\.(jpg|jpeg|png|webp)$')))
);
commit;
