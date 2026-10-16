begin;
alter table public.profiles
  add column public_id uuid not null default gen_random_uuid() unique,
  add column welcome_line text not null default '' check (char_length(welcome_line) <= 160),
  add constraint profiles_nonblank_name check (char_length(btrim(display_name)) between 1 and 80) not valid;
grant update(welcome_line) on public.profiles to authenticated;

-- Public pages use explicit projections below. Raw account profiles stay private.
alter policy profiles_read on public.profiles using (
  id = (select auth.uid()) or (select private.is_staff())
);

-- Deliberate public read endpoints. SECURITY DEFINER is necessary because public
-- callers cannot select other account profile rows. No auth/account tables or
-- private fields are returned. Both status and lifecycle are checked explicitly.
create function public.fas_public_profile(profile_key uuid, page_offset integer default 0)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'public_id',p.public_id,'display_name',p.display_name,'bio',p.bio,'welcome_line',p.welcome_line,
    'stories',coalesce((select jsonb_agg(jsonb_build_object('slug',s.slug,'title',s.title,'summary',s.summary,'published_at',s.published_at) order by s.published_at desc,s.id)
      from (select slug,title,summary,published_at,id from public.stories
        where author_id=p.id and status='published' order by published_at desc,id limit 12 offset page_offset) s),'[]'::jsonb),
    'next_offset',case when (select count(*) from public.stories where author_id=p.id and status='published')>page_offset+12 then page_offset+12 else null end
  ) from public.profiles p
  where p.public_id=profile_key and page_offset between 0 and 1000000
    and private.account_active(p.id) and (
      exists(select 1 from public.user_roles where user_id=p.id and role='member')
      or exists(select 1 from public.stories where author_id=p.id and status='published'));
$$;
revoke all on function public.fas_public_profile(uuid,integer) from public,anon,authenticated;
grant execute on function public.fas_public_profile(uuid,integer) to anon,authenticated;

create function public.fas_public_story(story_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('slug',s.slug,'title',s.title,'body',s.body,'summary',s.summary,
    'published_at',s.published_at,'updated_at',s.updated_at,
    'author',jsonb_build_object('public_id',p.public_id,'display_name',p.display_name))
  from public.stories s join public.profiles p on p.id=s.author_id
  where s.slug=story_slug and s.status='published' and private.account_active(p.id)
    and char_length(story_slug)<=120;
$$;
revoke all on function public.fas_public_story(text) from public,anon,authenticated;
grant execute on function public.fas_public_story(text) to anon,authenticated;
commit;
