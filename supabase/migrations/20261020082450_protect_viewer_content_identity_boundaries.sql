begin;
create or replace function private.viewer_content_target(content_key text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare item public.stories; legacy private.file_content; projection jsonb; path text; uuid_key uuid; slug_key text;type_key text;
begin
 if content_key is null or length(content_key)>180 then return null;end if;
 if content_key~'^[a-f0-9-]{36}$' then
  begin uuid_key:=content_key::uuid;exception when invalid_text_representation then return null;end;
  -- Legacy UUIDs are public and caller-chosen Studio UUIDs are untrusted.
  -- A collision must continue to resolve to the original file publication.
  select * into item from public.stories s where s.id=uuid_key and not exists(select 1 from private.file_content f where f.id=s.id and not f.editorial_migrated);
 elsif content_key~'^/(stories|games|tools|blog|videos)/[a-z0-9][a-z0-9-]{0,119}/$' then
  slug_key:=split_part(content_key,'/',3);type_key:=case split_part(content_key,'/',2) when 'stories' then 'story' when 'games' then 'game' when 'tools' then 'tool' when 'videos' then 'video' else 'blog' end;
  select * into item from public.stories where slug=slug_key and content_type=type_key;
 else return null;end if;
 if found then
  if exists(select 1 from private.file_content f where f.id=item.id and (not f.editorial_migrated or f.owner_id is distinct from item.author_id or f.slug<>item.slug or f.content_type<>item.content_type)) then return null;end if;
  projection:=public.fas_public_story(item.slug);
  if projection is null or projection->>'id'<>item.id::text then return null;end if;
  path:='/'||case item.content_type when 'story' then 'stories' when 'game' then 'games' when 'tool' then 'tools' else item.content_type end||'/'||item.slug||'/';
  return jsonb_build_object('id',item.id,'source','studio','type',item.content_type,'url',path,'title',item.title,'summary',item.summary,'cover',projection->'cover','published_at',item.published_at);
 end if;
 select * into legacy from private.file_content where (uuid_key is not null and id=uuid_key) or (uuid_key is null and url=content_key) limit 1;
 if not found then return null;end if;
 projection:=public.fas_public_file_content(legacy.url);
 if projection is null or projection->>'unavailable'='true' then return null;end if;
 return jsonb_build_object('id',legacy.id,'source','file','type',legacy.content_type,'url',legacy.url,'title',legacy.title,'summary',legacy.summary,'image',legacy.image,'image_alt',legacy.image_alt,'published_at',legacy.published_at);
end;$$;
create or replace function private.studio_acknowledgements(page_key uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;result jsonb;
begin
 caller:=private.require_operator_session();if not private.is_member() then raise exception 'Contributor access required';end if;
 with owned as(
 select id,title,'studio'::text as source from public.stories where author_id=caller and (page_key is null or id=page_key)
 union select id,title,'file'::text as source from private.file_content where owner_id=caller and not editorial_migrated and (page_key is null or id=page_key)
 ), totals as(
 select o.id,o.title,count(*) filter(where a.experienced) as experienced,count(*) filter(where a.loved) as loved
 from owned o left join private.viewer_content_actions a on (o.source='studio' and a.story_id=o.id or o.source='file' and a.file_id=o.id) group by o.id,o.title
 ) select jsonb_build_object('experienced',coalesce(sum(experienced),0),'loved',coalesce(sum(loved),0),'pages',coalesce(jsonb_agg(to_jsonb(totals) order by title),'[]'::jsonb)) into result from totals;
 return result;
end;$$;
notify pgrst,'reload schema';
commit;
