begin;
create or replace function public.fas_public_profile(profile_key uuid, page_offset integer default 0)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'public_id',p.public_id,'display_name',p.display_name,'bio',p.bio,'welcome_line',p.welcome_line,
    'stories',coalesce((select jsonb_agg(jsonb_build_object(
      'slug',s.slug,'title',s.title,'summary',s.summary,'published_at',s.published_at,
      'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text)
        from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and a.approved_at is not null)
      ) order by s.published_at desc,s.id)
      from (select slug,title,summary,published_at,id,cover_asset_id from public.stories
        where author_id=p.id and status='published' order by published_at desc,id limit 12 offset page_offset) s),'[]'::jsonb),
    'next_offset',case when (select count(*) from public.stories where author_id=p.id and status='published')>page_offset+12 then page_offset+12 else null end
  ) from public.profiles p
  where p.public_id=profile_key and page_offset between 0 and 1000000
    and private.account_active(p.id) and (
      exists(select 1 from public.user_roles where user_id=p.id and role in ('member','moderator','admin'))
      or exists(select 1 from public.stories where author_id=p.id and status='published'));
$$;
revoke all on function public.fas_public_profile(uuid,integer) from public,anon,authenticated;
grant execute on function public.fas_public_profile(uuid,integer) to anon,authenticated;
commit;
