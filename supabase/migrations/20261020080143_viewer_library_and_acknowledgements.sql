begin;
-- Account-only actions. No public totals, visitor tracking or discovery weighting.
create table private.viewer_content_actions(
 owner_id uuid not null references auth.users(id) on delete cascade,
 content_id uuid not null,
 story_id uuid references public.stories(id) on delete cascade,
 file_id uuid references private.file_content(id) on delete cascade,
 saved boolean not null default false,
 experienced boolean not null default false,
 loved boolean not null default false,
 saved_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(owner_id,content_id),
 check(num_nonnulls(story_id,file_id)=1),
 check(content_id=coalesce(story_id,file_id)),
 check(saved or experienced or loved)
);
create index viewer_actions_story on private.viewer_content_actions(story_id) where story_id is not null;
create index viewer_actions_file on private.viewer_content_actions(file_id) where file_id is not null;
alter table private.viewer_content_actions enable row level security;
revoke all on private.viewer_content_actions from public,anon,authenticated;
grant all on private.viewer_content_actions to service_role;
-- Public projection checks keep drafts, moderation and closed contributors unavailable.
create function private.viewer_content_target(content_key text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare item public.stories; legacy private.file_content; projection jsonb; path text; uuid_key uuid; slug_key text;type_key text;
begin
 if content_key is null or length(content_key)>180 then return null;end if;
 if content_key~'^[a-f0-9-]{36}$' then
  begin uuid_key:=content_key::uuid;exception when invalid_text_representation then return null;end;
  select * into item from public.stories where id=uuid_key;
 elsif content_key~'^/(stories|games|tools|blog|videos)/[a-z0-9][a-z0-9-]{0,119}/$' then
  slug_key:=split_part(content_key,'/',3);type_key:=case split_part(content_key,'/',2) when 'stories' then 'story' when 'games' then 'game' when 'tools' then 'tool' when 'videos' then 'video' else 'blog' end;
  select * into item from public.stories where slug=slug_key and content_type=type_key;
 else return null;end if;
 if found then
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
create function private.viewer_actions(content_keys text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;result jsonb;
begin
 caller:=private.require_operator_session();
 if content_keys is null or cardinality(content_keys)>100 then raise exception 'Choose up to 100 content pieces';end if;
 select coalesce(jsonb_agg(jsonb_build_object('key',k,'id',t->>'id','saved',coalesce(a.saved,false),'experienced',coalesce(a.experienced,false),'loved',coalesce(a.loved,false))) filter(where t is not null),'[]'::jsonb) into result
 from (select distinct unnest(content_keys) k) keys cross join lateral(select private.viewer_content_target(k) t) target
 left join private.viewer_content_actions a on a.owner_id=caller and a.content_id=(t->>'id')::uuid;
 return result;
end;$$;
create function private.set_viewer_action(content_key text,action_key text,enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;t jsonb;key uuid;a private.viewer_content_actions;
begin
 caller:=private.require_operator_session();
 if action_key is null or action_key not in ('saved','experienced','loved') or enabled is null then raise exception 'Choose a supported action';end if;
 -- Serialise this account's changes, including absent-row inserts and account closure.
 perform pg_advisory_xact_lock(hashtextextended(caller::text,146389896));
 if not private.account_active(caller) then raise exception 'Active account required';end if;
 t:=private.viewer_content_target(content_key);if t is null then raise exception 'Content unavailable';end if;
 key:=(t->>'id')::uuid;
 select * into a from private.viewer_content_actions where owner_id=caller and content_id=key for update;
 a.saved:=coalesce(a.saved,false);a.experienced:=coalesce(a.experienced,false);a.loved:=coalesce(a.loved,false);
 if action_key='saved' then if enabled and not a.saved then a.saved_at:=clock_timestamp();end if;a.saved:=enabled;if not enabled then a.saved_at:=null;end if;
 elsif action_key='experienced' then a.experienced:=enabled;else a.loved:=enabled;end if;
 if a.saved or a.experienced or a.loved then
  insert into private.viewer_content_actions(owner_id,content_id,story_id,file_id,saved,experienced,loved,saved_at)
  values(caller,key,case when t->>'source'='studio' then key end,case when t->>'source'='file' then key end,a.saved,a.experienced,a.loved,a.saved_at)
  on conflict(owner_id,content_id) do update set saved=excluded.saved,experienced=excluded.experienced,loved=excluded.loved,saved_at=excluded.saved_at,updated_at=clock_timestamp();
 else delete from private.viewer_content_actions where owner_id=caller and content_id=key;end if;
 return jsonb_build_object('key',content_key,'id',key,'saved',a.saved,'experienced',a.experienced,'loved',a.loved);
end;$$;
create function private.viewer_collection(collection_key text,before_time timestamptz default null,after_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;result jsonb;cursor jsonb;
begin
 caller:=private.require_operator_session();
 if collection_key is null or collection_key not in ('later','favourites') or (before_time is null)<>(after_id is null) then raise exception 'Choose a supported collection';end if;
 with page as materialized(
 select a.content_id,a.saved_at,t from private.viewer_content_actions a cross join lateral(select private.viewer_content_target(a.content_id::text) t) target
 where a.owner_id=caller and a.saved and t is not null and ((t->>'type' in ('game','tool'))=(collection_key='favourites'))
 and (before_time is null or a.saved_at<before_time or a.saved_at=before_time and a.content_id>after_id)
 order by a.saved_at desc,a.content_id limit 49
 ),limited as(select * from page order by saved_at desc,content_id limit 48)
 select coalesce(jsonb_agg(t order by saved_at desc,content_id),'[]'::jsonb),
 case when(select count(*) from page)>48 then(select jsonb_build_object('saved_at',saved_at,'id',content_id) from limited order by saved_at asc,content_id desc limit 1) end into result,cursor from limited;
 return jsonb_build_object('items',result,'next_cursor',cursor);
end;$$;
create function private.studio_acknowledgements(page_key uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;result jsonb;
begin
 caller:=private.require_operator_session();if not private.is_member() then raise exception 'Contributor access required';end if;
 with owned as(
 select id,title from public.stories where author_id=caller and (page_key is null or id=page_key)
 union select id,title from private.file_content where owner_id=caller and not editorial_migrated and (page_key is null or id=page_key)
 ), totals as(
 select o.id,o.title,count(*) filter(where a.experienced) as experienced,count(*) filter(where a.loved) as loved
 from owned o left join private.viewer_content_actions a on a.content_id=o.id group by o.id,o.title
 ) select jsonb_build_object('experienced',coalesce(sum(experienced),0),'loved',coalesce(sum(loved),0),'pages',coalesce(jsonb_agg(to_jsonb(totals) order by title),'[]'::jsonb)) into result from totals;
 return result;
end;$$;
create function public.fas_my_viewer_actions(content_keys text[]) returns jsonb language sql security invoker set search_path='' as $$select private.viewer_actions(content_keys);$$;
create function public.fas_set_viewer_action(content_key text,action_key text,enabled boolean) returns jsonb language sql security invoker set search_path='' as $$select private.set_viewer_action(content_key,action_key,enabled);$$;
create function public.fas_my_viewer_collection(collection_key text,before_time timestamptz default null,after_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.viewer_collection(collection_key,before_time,after_id);$$;
create function public.fas_my_studio_acknowledgements(page_key uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.studio_acknowledgements(page_key);$$;
revoke all on function private.viewer_content_target(text),private.viewer_actions(text[]),private.set_viewer_action(text,text,boolean),private.viewer_collection(text,timestamptz,uuid),private.studio_acknowledgements(uuid),public.fas_my_viewer_actions(text[]),public.fas_set_viewer_action(text,text,boolean),public.fas_my_viewer_collection(text,timestamptz,uuid),public.fas_my_studio_acknowledgements(uuid) from public,anon,authenticated;
grant execute on function private.viewer_actions(text[]),private.set_viewer_action(text,text,boolean),private.viewer_collection(text,timestamptz,uuid),private.studio_acknowledgements(uuid),public.fas_my_viewer_actions(text[]),public.fas_set_viewer_action(text,text,boolean),public.fas_my_viewer_collection(text,timestamptz,uuid),public.fas_my_studio_acknowledgements(uuid) to authenticated;
create or replace function public.fas_account_snapshot(target_user uuid, target_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  perform private.require_account_session(target_user,target_session);
  if not private.account_active(target_user) then raise exception 'Account is closing'; end if;
  if (select count(*) from (select 1 from public.stories where author_id=target_user limit 301) s)>300
    or (select coalesce(sum(octet_length(body)+coalesce(octet_length(executable_package::text),0)),0) from public.stories where author_id=target_user)>16777216
    or (select coalesce(sum(octet_length(snapshot::text)),0) from private.content_revisions where owner_id=target_user)>16777216
    or (select count(*) from (select 1 from public.story_assets a join public.stories s on s.id=a.story_id where s.author_id=target_user limit 501) a)>500
    or (select count(*) from (select 1 from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text limit 501) o)>500 then
    raise exception 'Account content requires background export';
  end if;
  select jsonb_build_object(
    'viewer_actions',coalesce((select jsonb_agg(to_jsonb(v)-'owner_id' order by content_id) from private.viewer_content_actions v where owner_id=target_user),'[]'::jsonb),
    'profile', (select to_jsonb(p) from public.profiles p where id = target_user),
    'role', coalesce((select role::text from public.user_roles where user_id = target_user order by case role when 'member' then 0 when 'admin' then 1 else 2 end limit 1),'viewer'),
    'stories', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.stories s where author_id = target_user),'[]'::jsonb),
    'content_revisions',coalesce((select jsonb_agg(to_jsonb(r)-'owner_id' order by captured_at,id) from private.content_revisions r where owner_id=target_user),'[]'::jsonb),
    'file_players',coalesce((select jsonb_agg(jsonb_build_object('url',f.url,'slug',f.slug,'content_type',f.content_type,'package',o.executable_package,'updated_at',o.updated_at) order by f.id) from private.file_content f join private.file_interactive_overrides o on o.file_id=f.id where f.owner_id=target_user and o.owner_id=target_user),'[]'::jsonb),
    'game_saves',coalesce((select jsonb_agg(to_jsonb(g)-'owner_id' order by game_id,slot) from private.game_saves g where owner_id=target_user),'[]'::jsonb),
    'game_participation',coalesce((select jsonb_agg(jsonb_build_object('game',r.game_id,'room',m.room_id,'player',m.player_id,'data',p.payload,'expiresAt',r.expires_at)) from private.game_members m join private.game_rooms r on r.id=m.room_id join public.game_player_state p using(room_id,player_id) where m.user_id=target_user),'[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'approved_by' order by a.id) from public.story_assets a join public.stories s on s.id = a.story_id where s.author_id = target_user),'[]'::jsonb),
    'objects', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'path',o.name,'size',o.metadata->>'size','type',o.metadata->>'mimetype','updated_at',o.updated_at) order by o.name) from storage.objects o where bucket_id = 'fas-story-images' and split_part(name,'/',1) = target_user::text),'[]'::jsonb)
  ) into payload;
  if payload->'profile' = 'null'::jsonb then raise exception 'Account unavailable'; end if;
  return jsonb_build_object('data',payload,'fingerprint',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end; $$;

create function private.viewer_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;
begin
 caller:=private.require_operator_session();
 return coalesce((select jsonb_agg(to_jsonb(v)-'owner_id' order by content_id) from private.viewer_content_actions v where owner_id=caller),'[]'::jsonb);
end;$$;
create function public.fas_my_viewer_data() returns jsonb language sql security invoker set search_path='' as $$select private.viewer_data();$$;
revoke all on function private.viewer_data(),public.fas_my_viewer_data() from public,anon,authenticated;
grant execute on function private.viewer_data(),public.fas_my_viewer_data() to authenticated;
notify pgrst,'reload schema';
commit;
