begin;
-- Only address allocation needs global visibility. Ownership, publication and
-- manuscript guards still run under their existing permissions first.
create function private.assign_unique_studio_address() returns trigger language plpgsql security definer set search_path='' as $$
declare proposed text;
begin
 if current_setting('role',true)='authenticated' and (TG_OP='INSERT' or (not old.slug_locked and new.title is distinct from old.title)) then
  proposed:=private.studio_slug(new.title);
  perform pg_advisory_xact_lock(hashtextextended(proposed,146389899));
  if exists(select 1 from public.stories where slug=proposed and id<>new.id) then proposed:=left(proposed,80)||'-'||replace(new.id::text,'-','');end if;
  new.slug:=proposed;
 end if;
 return new;
end;$$;
revoke all on function private.assign_unique_studio_address() from public,anon,authenticated;
create trigger fas_studio_unique_address before insert or update on public.stories for each row execute function private.assign_unique_studio_address();
commit;
