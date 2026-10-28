begin;
-- Public, opaque invalidation token only: never account IDs, drafts or timestamps.
create table public.public_content_revision (
 singleton boolean primary key default true check(singleton),
 revision uuid not null default gen_random_uuid()
);
alter table public.public_content_revision enable row level security;
revoke all on public.public_content_revision from public,anon,authenticated;
grant select on public.public_content_revision to anon,authenticated;
create policy public_content_revision_read on public.public_content_revision for select to anon,authenticated using(true);
insert into public.public_content_revision(singleton) values(true);
create function public.fas_public_content_revision() returns uuid
language sql stable security invoker set search_path='' as $$
 select revision from public.public_content_revision where singleton;
$$;
revoke all on function public.fas_public_content_revision() from public,anon,authenticated;
grant execute on function public.fas_public_content_revision() to anon,authenticated;
-- Trigger-only privilege; no API role can call this function or alter the token.
create function private.invalidate_public_content() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.public_content_revision set revision=gen_random_uuid() where singleton;
 return null;
end;$$;
revoke all on function private.invalidate_public_content() from public,anon,authenticated;
-- Every input to the published projections, including account closure and
-- contributor/FAS access removal. Statement triggers also cover bulk moderation.
create trigger fas_cache_revision after insert or update or delete or truncate on public.stories for each statement execute function private.invalidate_public_content();
create trigger fas_cache_revision after insert or update or delete or truncate on public.story_assets for each statement execute function private.invalidate_public_content();
create trigger fas_cache_revision after insert or update or delete or truncate on public.profiles for each statement execute function private.invalidate_public_content();
create trigger fas_cache_revision after insert or update or delete or truncate on public.user_roles for each statement execute function private.invalidate_public_content();
create trigger fas_cache_revision after insert or update or delete or truncate on private.file_content for each statement execute function private.invalidate_public_content();
create trigger fas_cache_revision after insert or update or delete or truncate on private.fas_publishers for each statement execute function private.invalidate_public_content();
create trigger fas_cache_revision after insert or update or delete or truncate on private.publishing_brand for each statement execute function private.invalidate_public_content();
create trigger fas_cache_revision after insert or update or delete or truncate on private.account_deletion_jobs for each statement execute function private.invalidate_public_content();
notify pgrst,'reload schema';
commit;
