begin;
-- Compute reading length only on writes, rather than parsing every manuscript
-- for each card request. No manuscript or package bytes enter the projection.
alter table public.stories add column discovery_minutes integer generated always as
 (case when content_type in ('story','blog') then greatest(1,ceil(cardinality(regexp_split_to_array(btrim(body),'\s+'))/225.0)::integer) else 0 end) stored;
alter table private.file_content add column discovery jsonb not null default '{}'::jsonb;
update private.file_content f set discovery=entry-'url' from jsonb_array_elements($metadata$[{"url":"/games/rally-clash/","subtype":"arcade","genres":["arcade"],"tags":["Arcade","Retro"],"readingMinutes":0,"gameFeatures":{"saves":false,"multiplayer":"off"},"image":"/assets/images/covers/rally-clash.jpg","imageAlt":"Arcade Rally Clash artwork","imageWidth":1600,"imageHeight":900},{"url":"/games/brick-blitz/","subtype":"arcade","genres":["arcade"],"tags":["Arcade","Retro"],"readingMinutes":0,"gameFeatures":{"saves":false,"multiplayer":"off"},"image":"/assets/images/covers/brick-blitz.jpg","imageAlt":"Arcade Brick Blitz artwork","imageWidth":1600,"imageHeight":900},{"url":"/tools/genre-randomizer/","subtype":"writing","genres":["writing-tool","creative-tool"],"tags":["Tool","Writing"],"readingMinutes":0,"gameFeatures":null,"image":"/assets/images/covers/genre-randomizer.jpg","imageAlt":"Genre Randomizer artwork","imageWidth":1600,"imageHeight":900},{"url":"/tools/countdown/","subtype":"focus","genres":["productivity"],"tags":["Tool","Focus","Countdown"],"readingMinutes":0,"gameFeatures":null,"image":"/assets/images/covers/countdown.jpg","imageAlt":"Countdown tool artwork","imageWidth":1600,"imageHeight":900},{"url":"/stories/onto-the-stage/","subtype":"short-story","genres":["literary-fiction","contemporary-fiction"],"tags":["theatre","performance","family expectations","self-doubt","friendship","courage","Short Story","Drama","Courage"],"readingMinutes":2,"gameFeatures":null,"image":"/assets/images/covers/onto-the-stage.jpg","imageAlt":"A nervous performer looking through a red theatre curtain towards the audience","imageWidth":1600,"imageHeight":900},{"url":"/stories/moon-hoc-meeting/","subtype":"short-story","genres":["science-fiction","humour"],"tags":["moon colony","homeowners committee","lunar dome","rebellion","vandalism","revenge","Short Story","Science Fiction","Dark Comedy"],"readingMinutes":2,"gameFeatures":null,"image":"/assets/images/covers/moon-hoc-meeting.jpg","imageAlt":"Featured artwork for Moon HOC Meeting","imageWidth":1600,"imageHeight":900},{"url":"/stories/the-deal/","subtype":"short-story","genres":["horror","dark-fantasy","supernatural"],"tags":["moonless forest","supernatural entity","dangerous bargain","sacrifice","resurrection","sisters","Short Story","Supernatural Horror","Dark Fantasy"],"readingMinutes":2,"gameFeatures":null,"image":"/assets/images/covers/the-deal.jpg","imageAlt":"Featured artwork for The Deal","imageWidth":1600,"imageHeight":900},{"url":"/stories/a-place-left-behind/","subtype":"short-story","genres":["literary-fiction","contemporary-fiction"],"tags":["abandoned house","old photographs","childhood memories","fire damage","returning home","loss","Short Story","Emotional Fiction","Atmospheric Fiction"],"readingMinutes":2,"gameFeatures":null,"image":"/assets/images/covers/a-place-left-behind.jpg","imageAlt":"Featured artwork for A Place Left Behind","imageWidth":1600,"imageHeight":900},{"url":"/stories/the-labyrinth/","subtype":"short-story","genres":["fantasy","dark-fantasy","adventure"],"tags":["labyrinth","warriors","betrayal","survival","monsters","sacrifice","Short Story","Fantasy Fiction","Dark Fantasy"],"readingMinutes":2,"gameFeatures":null,"image":"/assets/images/covers/the-labyrinth.jpg","imageAlt":"Featured artwork for The Labyrinth","imageWidth":1600,"imageHeight":900},{"url":"/stories/sunset-at-the-lighthouse/","subtype":"short-story","genres":["fantasy","romance"],"tags":["lighthouse","mermaid","ocean","sunset","reunion","waiting","Short Story","Fantasy Fiction","Romantic Fantasy"],"readingMinutes":2,"gameFeatures":null,"image":"/assets/images/covers/sunset-at-the-lighthouse.jpg","imageAlt":"Featured artwork for Sunset at the Lighthouse","imageWidth":1600,"imageHeight":900},{"url":"/stories/crypt-of-the-blood-jewel/","subtype":"short-story","genres":["fantasy","adventure","dark-fantasy"],"tags":["crypt","treasure","Blood Jewel","treasure hunter","ancient guardian","statue","Short Story","Fantasy Fiction","Adventure Fantasy"],"readingMinutes":2,"gameFeatures":null,"image":"/assets/images/covers/crypt-of-the-blood-jewel.jpg","imageAlt":"Featured artwork for Crypt of the Blood Jewel","imageWidth":1600,"imageHeight":900},{"url":"/stories/date-night-jigsaw/","subtype":"short-story","genres":["horror","mystery","psychological-thriller"],"tags":["jigsaw","puzzle","mysterious package","date night","phone call","dagger","missing person","Short Story","Psychological Horror","Mystery Fiction"],"readingMinutes":2,"gameFeatures":null,"image":"/assets/images/covers/date-night-jigsaw.jpg","imageAlt":"Featured artwork for Date Night Jigsaw","imageWidth":1600,"imageHeight":900},{"url":"/stories/tea-at-the-summit/","subtype":"short-story","genres":["literary-fiction","adventure"],"tags":["mountain","summit","snow","tea","urn","climbing","remembrance","Short Story","Literary Fiction","Emotional Fiction"],"readingMinutes":2,"gameFeatures":null,"image":"/assets/images/covers/tea-at-the-summit.jpg","imageAlt":"Featured artwork for Tea at the Summit","imageWidth":1600,"imageHeight":900},{"url":"/stories/michaels-choice/","subtype":"short-story","genres":["literary-fiction","contemporary-fiction"],"tags":["workplace","bullying","harassment","friendship","alcohol","bar","yoga","cafe","Short Story","Literary Fiction","Contemporary Fiction"],"readingMinutes":22,"gameFeatures":null,"image":"/assets/images/covers/michaels-choice.jpg","imageAlt":"Featured artwork for Michael's Choice","imageWidth":1600,"imageHeight":900}]$metadata$::jsonb) entry where f.url=entry->>'url';



-- Replace the expensive full-editorial construction with identical visibility
-- predicates and a metadata-only projection. Preserve unavailable tombstones.
create or replace function public.fas_public_file_catalog() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(case when a.author is null or f.editorial_migrated and (s.id is null or s.status<>'published') then jsonb_build_object('url',f.url,'unavailable',true)
 else jsonb_build_object('id',f.id,'source_kind','file','url',f.url,'slug',f.slug,'title',coalesce(s.title,f.title),'summary',coalesce(s.summary,f.summary),'content_type',f.content_type,'published_at',coalesce(s.published_at,f.published_at),'updated_at',coalesce(s.updated_at,f.updated_at),'preview_image',f.image,'preview_alt',f.image_alt,'author',a.author)
 ||case when f.editorial_migrated then '{"editorial_migrated":true}'::jsonb else '{}'::jsonb end end order by f.url),'[]'::jsonb)
 from private.file_content f left join public.stories s on f.editorial_migrated and s.id=f.id and s.author_id=f.owner_id
 cross join lateral(select private.public_publishing_author(f.owner_id,coalesce(s.publishing_identity,f.publishing_identity)) author)a;
$$;

create or replace function public.fas_public_discovery() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('files',public.fas_public_file_catalog(),'stories',public.fas_public_story_catalog());
$$;
revoke all on function public.fas_public_discovery() from public;
grant execute on function public.fas_public_discovery() to anon,authenticated;

create or replace function private.discovery_cards() returns setof jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'slug',s.slug,'url','/'||case s.content_type when 'story' then 'stories' when 'game' then 'games' when 'tool' then 'tools' else s.content_type end||'/'||s.slug||'/',
 'title',s.title,'summary',s.summary,'content_type',s.content_type,'status','published','published_at',s.published_at,'updated_at',s.updated_at,
 'subtype',coalesce(f.discovery->>'subtype',s.content_type),'tags',s.tags,'genres',s.genres,'reading_minutes',s.discovery_minutes,'author',a.author,
 'cover',(select jsonb_build_object('asset_id',x.id,'alt',x.alt_text,'width',x.pixel_width,'height',x.pixel_height) from public.story_assets x where x.id=s.cover_asset_id and x.story_id=s.id and (x.verified_at is not null or x.approved_at is not null)),
 'game_features',case when s.content_type='game' then jsonb_build_object('saves',coalesce((s.executable_package->'settings'->>'saves')::boolean,false),'multiplayer',coalesce(s.executable_package->'settings'->>'multiplayer','off')) else null end)
 from public.stories s left join private.file_content f on f.id=s.id and f.editorial_migrated and f.owner_id=s.author_id
 cross join lateral(select private.public_publishing_author(s.author_id,s.publishing_identity) author)a
 where s.status='published' and s.published_at is not null and a.author is not null
 union all
 select jsonb_build_object('id',f.id,'slug',f.slug,'url',f.url,'title',f.title,'summary',f.summary,'content_type',f.content_type,'status','published','published_at',f.published_at,'updated_at',f.updated_at,
 'subtype',coalesce(f.discovery->>'subtype',f.content_type),'tags',coalesce(f.discovery->'tags','[]'::jsonb),'genres',coalesce(f.discovery->'genres','[]'::jsonb),'reading_minutes',coalesce((f.discovery->>'readingMinutes')::integer,0),'author',a.author,
 'preview_image',coalesce(f.discovery->>'image',f.image),'preview_alt',coalesce(f.discovery->>'imageAlt',f.image_alt),'preview_width',coalesce((f.discovery->>'imageWidth')::integer,1600),'preview_height',coalesce((f.discovery->>'imageHeight')::integer,900),'game_features',f.discovery->'gameFeatures')
 from private.file_content f cross join lateral(select private.public_publishing_author(f.owner_id,f.publishing_identity) author)a where not f.editorial_migrated and a.author is not null;
$$;
revoke all on function private.discovery_cards() from public;

create or replace function private.discovery_family(value text) returns text
language sql immutable set search_path='' as $$
 select case when value ~* 'fantasy|fairy-tale|magical-realism' then 'fantasy' when value ~* 'science-fiction|sci-fi|cyberpunk|dystopian|space-opera|time-travel|artificial-intelligence' then 'science-fiction' when value ~* 'horror|supernatural|gothic|occult' then 'horror' when value ~* 'mystery|thriller|crime|suspense' then 'mystery' else lower(value) end;
$$;
revoke all on function private.discovery_family(text) from public;

create or replace function private.query_discovery(options jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q text:=btrim(coalesce(options->>'q','')); category text:=coalesce(options->>'category',''); sorting text:=coalesce(nullif(options->>'sort',''),'newest');
 page_offset integer:=coalesce((options->>'offset')::integer,0); page_size integer:=coalesce((options->>'limit')::integer,24); related text:=coalesce(options->>'related',''); result jsonb;
begin
 if options is null or jsonb_typeof(options)<>'object' or exists(select 1 from jsonb_object_keys(options) k where k not in ('q','category','subtype','genre','tag','players','saves','length','sort','offset','limit','related'))
 or char_length(options::text)>2048 or char_length(q)>160 or page_offset<0 or page_offset>50000 or page_size<1 or page_size>24
 or sorting not in ('newest','oldest','title','shortest','longest') or category not in ('','stories','games','tools','blog','videos','gallery')
 or coalesce(options->>'players','') not in ('','single','multi') or coalesce(options->>'saves','') not in ('','yes') or coalesce(options->>'length','') not in ('','quick','medium','long') then raise exception 'Invalid discovery query';end if;
 with cards as materialized(select c,case c->>'content_type' when 'story' then 'stories' when 'game' then 'games' when 'tool' then 'tools' when 'video' then 'videos' else c->>'content_type' end cat from private.discovery_cards() c),
 current_piece as(select c from cards where c->>'url'=related limit 1),
 filtered as(select c,cat,
 case when q='' then 0 when lower(c->>'title')=lower(q) then 120 when strpos(lower(c->>'title'),lower(q))>0 then 80 else 30 end score,
 case when related<>'' and c->>'content_type'=(select c->>'content_type' from current_piece) then 1 else 0 end same_type,
 case when related<>'' and exists(select 1 from jsonb_array_elements_text(c->'genres') g join jsonb_array_elements_text((select c->'genres' from current_piece)) own on private.discovery_family(g.value)=private.discovery_family(own.value)) then 1 else 0 end genre_match
 from cards where (category='' or cat=category)
 and (related='' or exists(select 1 from current_piece) and c->>'url'<>related)
 and (q='' or to_tsvector('simple',coalesce(c->>'title','')||' '||coalesce(c->>'summary','')||' '||coalesce(c->'author'->>'display_name','')||' '||coalesce(c->>'tags','')||' '||coalesce(c->>'genres','')||' '||cat) @@ plainto_tsquery('simple',q)
 or strpos(lower(coalesce(c->>'title','')||' '||coalesce(c->>'summary','')||' '||coalesce(c->'author'->>'display_name','')||' '||coalesce(c->>'tags','')),lower(q))>0)
 and (coalesce(options->>'subtype','')='' or c->>'subtype'=options->>'subtype')
 and (coalesce(options->>'genre','')='' or exists(select 1 from jsonb_array_elements_text(c->'genres') g where lower(regexp_replace(g.value,'[^a-zA-Z0-9]+','-','g'))=lower(regexp_replace(options->>'genre','[^a-zA-Z0-9]+','-','g'))))
 and (coalesce(options->>'tag','')='' or c->'tags' ? (options->>'tag'))
 and (coalesce(options->>'players','')='' or case options->>'players' when 'single' then c->'game_features'->>'multiplayer'='off' else c->'game_features'->>'multiplayer' in ('casual','realtime') end)
 and (coalesce(options->>'saves','')='' or c->'game_features'->>'saves'='true')
 and (coalesce(options->>'length','')='' or cat in ('stories','blog') and case options->>'length' when 'quick' then (c->>'reading_minutes')::int between 1 and 4 when 'medium' then (c->>'reading_minutes')::int between 5 and 15 else (c->>'reading_minutes')::int>15 end)),
 ranked as(select c,row_number() over(order by same_type desc,case when same_type=1 then genre_match else 0 end desc,score desc,
 case when sorting='title' and related='' then lower(c->>'title') end,
 case when sorting in ('shortest','longest') and related='' then case when (c->>'reading_minutes')::int=0 then 1 else 0 end end,
 case when sorting='shortest' and related='' then (c->>'reading_minutes')::int end,
 case when sorting='longest' and related='' then (c->>'reading_minutes')::int end desc,
 case when sorting='oldest' and related='' then (c->>'published_at')::timestamptz end,
 (c->>'published_at')::timestamptz desc,c->>'id') n from filtered),
 featured as(select c,row_number() over(partition by c->'author'->>'public_id' order by (c->>'published_at')::timestamptz desc,c->>'id') n from cards where category='' or cat=category),
 facets as(select cat,jsonb_build_object('category',cat,'subtype',subtype,'genres',coalesce((select jsonb_agg(distinct g.value) from cards x cross join lateral jsonb_array_elements_text(x.c->'genres') g where x.cat=t.cat),'[]'::jsonb),'tags',coalesce((select jsonb_agg(distinct g.value) from cards x cross join lateral jsonb_array_elements_text(x.c->'tags') g where x.cat=t.cat),'[]'::jsonb),'gameFeatures',case when cat='games' then '{"multiplayer":"off","saves":true}'::jsonb else null end) item from (select distinct cat,c->>'subtype' subtype from cards)t)
 select jsonb_build_object('items',coalesce((select jsonb_agg(c order by n) from ranked where n>page_offset and n<=page_offset+page_size),'[]'::jsonb),
 'next_cursor',case when (select count(*) from filtered)>page_offset+page_size then jsonb_build_object('offset',page_offset+page_size) else null end,'total',(select count(*) from filtered),
 'facet_items',coalesce((select jsonb_agg(item) from facets),'[]'::jsonb),
 'featured',coalesce((select jsonb_agg(c order by (c->>'published_at')::timestamptz desc,c->>'id') from (select c from featured where n=1 order by (c->>'published_at')::timestamptz desc,c->>'id' limit 24) f),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function private.query_discovery(jsonb) from public;
grant execute on function private.query_discovery(jsonb) to anon,authenticated;
create or replace function public.fas_query_public_content(options jsonb default '{}'::jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$select private.query_discovery(options);$$;
revoke all on function public.fas_query_public_content(jsonb) from public;
grant execute on function public.fas_query_public_content(jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
