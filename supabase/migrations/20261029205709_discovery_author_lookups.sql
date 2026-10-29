begin;
set local lock_timeout='3s';
-- Reuse public-author checks per (owner, publishing identity) in this statement.
-- No identity, permission or account state survives into the next query.
create or replace function private.discovery_cards() returns setof jsonb
language sql stable security definer set search_path='' as $$
 with author_keys as materialized (
   select author_id as owner_id, publishing_identity
   from public.stories where status='published' and published_at is not null
   union
   select owner_id, publishing_identity
   from private.file_content where not editorial_migrated and owner_id is not null
 ), authors as materialized (
   select owner_id, publishing_identity,
     private.public_publishing_author(owner_id,publishing_identity) as author
   from author_keys
 )
 select jsonb_build_object('id',s.id,'slug',s.slug,'url','/'||case s.content_type when 'story' then 'stories' when 'game' then 'games' when 'tool' then 'tools' else s.content_type end||'/'||s.slug||'/',
 'title',s.title,'summary',s.summary,'content_type',s.content_type,'status','published','published_at',s.published_at,'updated_at',s.updated_at,
 'subtype',coalesce(f.discovery->>'subtype',s.content_type),'tags',s.tags,'genres',s.genres,'reading_minutes',s.discovery_minutes,'author',a.author,
 'cover',(select jsonb_build_object('asset_id',x.id,'alt',x.alt_text,'width',x.pixel_width,'height',x.pixel_height) from public.story_assets x where x.id=s.cover_asset_id and x.story_id=s.id and (x.verified_at is not null or x.approved_at is not null)),
 'game_features',case when s.content_type='game' then jsonb_build_object('saves',coalesce((s.executable_package->'settings'->>'saves')::boolean,false),'multiplayer',coalesce(s.executable_package->'settings'->>'multiplayer','off')) else null end)
 from public.stories s left join private.file_content f on f.id=s.id and f.editorial_migrated and f.owner_id=s.author_id
 join authors a on a.owner_id=s.author_id and a.publishing_identity is not distinct from s.publishing_identity
 where s.status='published' and s.published_at is not null and a.author is not null
 union all
 select jsonb_build_object('id',f.id,'slug',f.slug,'url',f.url,'title',f.title,'summary',f.summary,'content_type',f.content_type,'status','published','published_at',f.published_at,'updated_at',f.updated_at,
 'subtype',coalesce(f.discovery->>'subtype',f.content_type),'tags',coalesce(f.discovery->'tags','[]'::jsonb),'genres',coalesce(f.discovery->'genres','[]'::jsonb),'reading_minutes',coalesce((f.discovery->>'readingMinutes')::integer,0),'author',a.author,
 'preview_image',coalesce(f.discovery->>'image',f.image),'preview_alt',coalesce(f.discovery->>'imageAlt',f.image_alt),'preview_width',coalesce((f.discovery->>'imageWidth')::integer,1600),'preview_height',coalesce((f.discovery->>'imageHeight')::integer,900),'game_features',f.discovery->'gameFeatures')
 from private.file_content f join authors a on a.owner_id=f.owner_id and a.publishing_identity is not distinct from f.publishing_identity where not f.editorial_migrated and a.author is not null;
$$;
revoke all on function private.discovery_cards() from public,anon,authenticated,service_role;
commit;
