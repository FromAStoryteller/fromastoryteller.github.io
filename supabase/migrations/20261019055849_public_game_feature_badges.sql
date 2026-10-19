begin;
-- Derive public game badges from the published package. No code, assets,
-- save schemas, account IDs or player data are added to discovery.
create or replace function private.public_story_catalog(before_time timestamptz default null,after_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; cursor jsonb;
begin
 if (before_time is null)<>(after_id is null) then raise exception 'Invalid public catalog cursor';end if;
 with page as(
  select s.* from public.stories s
  where s.status='published' and s.published_at is not null and private.account_active(s.author_id)
   and exists(select 1 from public.user_roles where user_id=s.author_id and role='member')
   and (before_time is null or s.published_at<before_time or s.published_at=before_time and s.id>after_id)
  order by s.published_at desc,s.id limit 61
 ), limited as(select * from page order by published_at desc,id limit 60)
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'title',s.title,'summary',s.summary,
  'content_type',s.content_type,'status','published','published_at',s.published_at,'updated_at',s.updated_at,
  'game_features',case when s.content_type='game' then jsonb_build_object('saves',coalesce((s.executable_package->'settings'->>'saves')::boolean,false),'multiplayer',coalesce(s.executable_package->'settings'->>'multiplayer','off')) else null end,
  'tags',s.tags,'genres',s.genres,'reading_minutes',greatest(1,ceil(cardinality(regexp_split_to_array(btrim(s.body),'\s+'))/225.0)),
  'author',private.public_publishing_author(s.author_id,s.publishing_identity),
  'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text,'width',a.pixel_width,'height',a.pixel_height) from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and (a.verified_at is not null or a.approved_at is not null))
 ) order by s.published_at desc,s.id),'[]'::jsonb),
 case when(select count(*) from page)>60 then(select jsonb_build_object('published_at',published_at,'id',id) from limited order by published_at asc,id desc limit 1) else null end
 into result,cursor from limited s;
 return jsonb_build_object('items',result,'next_cursor',cursor);
end;$$;
revoke all on function private.public_story_catalog(timestamptz,uuid) from public,anon,authenticated;
grant execute on function private.public_story_catalog(timestamptz,uuid) to anon,authenticated;
create or replace function public.fas_public_story_catalog(before_time timestamptz default null,after_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.public_story_catalog(before_time,after_id);
$$;
revoke all on function public.fas_public_story_catalog(timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.fas_public_story_catalog(timestamptz,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
