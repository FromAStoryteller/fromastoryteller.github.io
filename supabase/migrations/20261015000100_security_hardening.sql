-- Additive FAS migration. Keep the three already-applied migrations unchanged.
begin;

-- 'member' is the existing contributor role. A viewer has no user_roles row.
-- Never infer authorization from editable Auth user_metadata.
create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('member','moderator','admin'));
$$;

-- Remove possible PUBLIC privileges as well as the client-role defaults.
revoke all on public.profiles, public.user_roles, public.invites, public.stories,
  public.story_assets, public.moderation_log from public;
revoke all on sequence public.moderation_log_id_seq from public, anon, authenticated;

alter table public.story_assets
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id),
  add constraint asset_approval_pair check ((approved_at is null) = (approved_by is null));
-- Existing images deliberately remain unapproved until staff inspect them.
create function private.clear_image_approval() returns trigger
language plpgsql set search_path = '' as $$ begin
  if new.alt_text is distinct from old.alt_text then
    new.approved_at := null;
    new.approved_by := null;
  end if;
  return new;
end; $$;
revoke all on function private.clear_image_approval() from public, anon, authenticated;
create trigger fas_clear_image_approval before update of alt_text on public.story_assets
for each row execute function private.clear_image_approval();

create function public.approve_story_image(target_asset uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare asset public.story_assets; story_state public.story_status;
begin
  if not private.is_staff() then raise exception 'Staff required'; end if;
  select * into asset from public.story_assets where id = target_asset;
  if not found then raise exception 'Asset not found'; end if;
  -- Same story lock as registration/moderation: approval cannot race publication.
  select status into story_state from public.stories where id = asset.story_id for update;
  if story_state not in ('draft','rejected','submitted','published') then
    raise exception 'Story is not eligible for image approval';
  end if;
  if not exists(select 1 from storage.objects
    where bucket_id = 'fas-story-images' and name = asset.object_path) then
    raise exception 'Upload the registered image first';
  end if;
  update public.story_assets set approved_at = now(), approved_by = auth.uid()
    where id = target_asset;
end; $$;
revoke all on function public.approve_story_image(uuid) from public, anon, authenticated;
grant execute on function public.approve_story_image(uuid) to authenticated;

-- Restrictive policies intersect other permissive policies, including later ones.
-- No browser can set approval columns (existing column grants exclude them).
create policy assets_visibility_gate on public.story_assets as restrictive
for select to anon, authenticated using (
  exists(select 1 from public.stories s where s.id = story_id and (
    s.author_id = (select auth.uid()) or (select private.is_staff())
    or (s.status = 'published' and approved_at is not null)))
);
create policy stories_visibility_gate on public.stories as restrictive
for select to anon, authenticated using (
  status = 'published' or author_id = (select auth.uid()) or (select private.is_staff())
);
create policy stories_insert_gate on public.stories as restrictive
for insert to authenticated with check (
  author_id = (select auth.uid()) and (select private.is_member()) and status = 'draft'
);
create policy stories_update_gate on public.stories as restrictive
for update to authenticated using (
  author_id = (select auth.uid()) and (select private.is_member()) and status in ('draft','rejected')
) with check (
  author_id = (select auth.uid()) and (select private.is_member()) and status in ('draft','submitted')
);
create policy roles_no_client_writes on public.user_roles as restrictive
for all to anon, authenticated using (
  user_id = (select auth.uid()) or (select private.is_admin())
) with check (false);
create policy roles_no_client_delete on public.user_roles as restrictive
for delete to anon, authenticated using (false);

-- Use a restrictive gate scoped to this bucket; unrelated buckets are untouched.
create policy fas_images_read_gate on storage.objects as restrictive
for select to anon, authenticated using (
  bucket_id <> 'fas-story-images' or exists (
    select 1 from public.story_assets a join public.stories s on s.id = a.story_id
    where a.object_path = name and (
      s.author_id = (select auth.uid()) or (select private.is_staff())
      or (s.status = 'published' and a.approved_at is not null)))
);
create policy fas_images_insert_gate on storage.objects as restrictive
for insert to anon, authenticated with check (
  bucket_id <> 'fas-story-images' or (
    (select private.is_member()) and exists (
      select 1 from public.stories s where s.author_id = (select auth.uid())
      and s.status in ('draft','rejected')
      and name ~ ('^' || s.author_id::text || '/' || s.id::text || '/[a-f0-9-]+\.(jpg|jpeg|png|webp)$')))
);
create policy fas_images_no_update on storage.objects as restrictive
for update to anon, authenticated using (bucket_id <> 'fas-story-images')
with check (bucket_id <> 'fas-story-images');
create policy fas_images_no_delete on storage.objects as restrictive
for delete to anon, authenticated using (bucket_id <> 'fas-story-images');

-- Fail instead of silently repairing a mistakenly public bucket during deployment.
do $$ begin
  if not exists(select 1 from storage.buckets where id = 'fas-story-images' and not public) then
    raise exception 'FAS image bucket must exist and be private';
  end if;
end; $$;
commit;
