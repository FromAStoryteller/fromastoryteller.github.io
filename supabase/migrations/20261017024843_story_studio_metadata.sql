begin;
-- Additive editor metadata. Existing ownership, lifecycle, policy and moderation
-- guards continue to apply to these columns through the same stories table.
alter table public.stories
  add column genre text not null default '' check (char_length(genre) <= 80),
  add column tags text[] not null default '{}' check (
    cardinality(tags) <= 12 and array_position(tags,null) is null
    and (cardinality(tags)=0 or (array_ndims(tags)=1 and array_lower(tags,1)=1))
    and char_length(array_to_string(tags,'')) <= 480),
  add column content_warning text not null default '' check (char_length(content_warning) <= 1000);
grant insert(genre,tags,content_warning), update(genre,tags,content_warning) on public.stories to authenticated;

-- Only the public projection changes; no raw profiles, storage paths or draft
-- content are exposed. Image delivery still rechecks approval/access each time.
create or replace function public.fas_public_story(story_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('slug',s.slug,'title',s.title,'body',s.body,'summary',s.summary,
    'genre',s.genre,'tags',s.tags,'content_warning',s.content_warning,
    'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text)
      from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and a.approved_at is not null),
    'published_at',s.published_at,'updated_at',s.updated_at,
    'author',jsonb_build_object('public_id',p.public_id,'display_name',p.display_name))
  from public.stories s join public.profiles p on p.id=s.author_id
  where s.slug=story_slug and s.status='published' and private.account_active(p.id)
    and char_length(story_slug)<=120;
$$;
revoke all on function public.fas_public_story(text) from public,anon,authenticated;
grant execute on function public.fas_public_story(text) to anon,authenticated;
commit;
