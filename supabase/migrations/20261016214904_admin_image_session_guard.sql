begin;
create or replace function public.approve_story_image(target_asset uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare asset public.story_assets; story_state public.story_status;
begin
  perform private.require_operator_session();
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
  insert into private.admin_audit(actor_id,action,subject_id,reason) values(auth.uid(),'image_approved',target_asset,'Story image approved');
end; $$;
revoke all on function public.approve_story_image(uuid) from public, anon, authenticated;
grant execute on function public.approve_story_image(uuid) to authenticated;

commit;
