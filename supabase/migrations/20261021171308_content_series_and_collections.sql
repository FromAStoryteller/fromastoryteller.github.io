begin;

-- Relationships are separate from manuscripts and player files. No client table
-- access: all changes recheck current session, contributor and ownership gates.
create table private.content_series (
 source text not null check(source in ('studio','file')),
 content_id uuid not null,
 owner_id uuid not null references auth.users(id) on delete cascade,
 collection_name text not null default '' check(collection_name=btrim(collection_name) and length(collection_name)<=100),
 series_name text not null default '' check(series_name=btrim(series_name) and length(series_name)<=100),
 previous_source text check(previous_source in ('studio','file')),
 previous_id uuid,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(source,content_id),
 check((previous_source is null)=(previous_id is null)),
 check(previous_id is null or series_name<>''),
 check(previous_id is null or (previous_source,previous_id)<>(source,content_id))
);
create unique index content_series_one_successor on private.content_series(previous_source,previous_id) where previous_id is not null;
create index content_series_owner on private.content_series(owner_id);
alter table private.content_series enable row level security;
revoke all on private.content_series from public,anon,authenticated;
grant all on private.content_series to service_role;

create view private.series_content_index with(security_invoker=true) as
 select 'studio'::text source,s.id,s.author_id owner_id,s.publishing_identity,s.title,s.content_type,s.status::text status,
 '/'||case s.content_type when 'story' then 'stories' when 'game' then 'games' when 'tool' then 'tools' else s.content_type end||'/'||s.slug||'/' path
 from public.stories s where not exists(select 1 from private.file_content f where f.id=s.id and not f.editorial_migrated)
 union all select 'file',f.id,f.owner_id,f.publishing_identity,f.title,f.content_type,'published',f.url
 from private.file_content f where not f.editorial_migrated;
revoke all on private.series_content_index from public,anon,authenticated;

create function private.series_edit_target(source_key text,content_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;item private.series_content_index;begin
 caller:=private.require_operator_session();
 select * into item from private.series_content_index where source=source_key and id=content_key;
 if not found or item.status='archived' or not private.can_edit_studio_content(item.owner_id,item.publishing_identity,caller) then raise exception 'Reopen editable content from Your work';end if;
 return to_jsonb(item);
end;$$;

create function private.series_editor(content_key uuid,source_key text,page_after text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare target jsonb;items jsonb;cursor text;begin
 target:=private.series_edit_target(source_key,content_key);
 if page_after is not null and length(page_after)>50 then raise exception 'Invalid series page';end if;
 with page as materialized(
 select i.*,i.source||':'||i.id::text key,r.collection_name,r.series_name,r.previous_source,r.previous_id
 from private.series_content_index i left join private.content_series r on (r.source,r.content_id)=(i.source,i.id)
 where i.status<>'archived' and private.can_edit_studio_content(i.owner_id,i.publishing_identity,auth.uid()) and (target->>'publishing_identity'='fas' and i.publishing_identity='fas' or target->>'publishing_identity'='personal' and i.publishing_identity='personal' and i.owner_id=(target->>'owner_id')::uuid)
 and (page_after is null or i.source||':'||i.id::text>page_after)
 order by i.source||':'||i.id::text limit 101
 ),limited as(select * from page order by key limit 100)
 select coalesce(jsonb_agg(jsonb_build_object('key',key,'id',id,'source',source,'title',title,'type',content_type,'status',status,'collection_name',coalesce(collection_name,''),'series_name',coalesce(series_name,''),'previous_key',case when previous_id is not null then previous_source||':'||previous_id::text end) order by key),'[]'),
 case when(select count(*) from page)>100 then(select key from limited order by key desc limit 1) end into items,cursor from limited;
 return jsonb_build_object('current',coalesce((select to_jsonb(r) from private.content_series r where (r.source,r.content_id)=(source_key,content_key)),'{}'),'items',items,'next_cursor',cursor);
end;$$;

create function private.save_content_series(content_key uuid,source_key text,collection_title text,series_title text,previous_key text default null,expected_version timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare target jsonb;prior jsonb;old private.content_series;parent private.content_series;child private.content_series;previous_source_key text;previous_content_key uuid;walk_source text;walk_id uuid;seen text[]:='{}';row_exists boolean;begin
 -- Serialize graph changes, including two concurrent attempts to append to a tail.
 perform pg_advisory_xact_lock(146389896,7319);
 target:=private.series_edit_target(source_key,content_key);
 collection_title:=btrim(collection_title);series_title:=btrim(series_title);
 if collection_title is null or series_title is null or length(collection_title)>100 or length(series_title)>100 then raise exception 'Use up to 100 characters for a collection or series name';end if;
 select * into old from private.content_series where (source,content_id)=(source_key,content_key) for update;row_exists:=found;
 if (row_exists and old.updated_at is distinct from expected_version) or (not row_exists and expected_version is not null) then raise exception using errcode='P0002',message='Series details changed elsewhere. Reload them before saving';end if;
 if previous_key is not null then
  if series_title='' or previous_key!~'^(studio|file):[a-f0-9-]{36}$' then raise exception 'Choose a previous piece and a series name';end if;
  previous_source_key:=split_part(previous_key,':',1);previous_content_key:=split_part(previous_key,':',2)::uuid;
  prior:=private.series_edit_target(previous_source_key,previous_content_key);
  if prior->>'publishing_identity' is distinct from target->>'publishing_identity' or target->>'publishing_identity'<>'fas' and prior->>'owner_id' is distinct from target->>'owner_id' then raise exception 'Choose work from the same contributor and publishing name';end if;
  if (previous_source_key,previous_content_key)=(source_key,content_key) then raise exception 'A piece cannot come after itself';end if;
  select * into parent from private.content_series where (source,content_id)=(previous_source_key,previous_content_key);
  if found and (parent.series_name<>'' and lower(parent.series_name)<>lower(series_title) or parent.collection_name<>'' and lower(parent.collection_name)<>lower(collection_title)) then raise exception 'The previous piece belongs to a different series or collection';end if;
  if exists(select 1 from private.content_series where (previous_source,previous_id)=(previous_source_key,previous_content_key) and (source,content_id)<>(source_key,content_key)) then raise exception 'That piece already has a following part. Choose the last part or edit its existing link first';end if;
  walk_source:=previous_source_key;walk_id:=previous_content_key;
  while walk_id is not null loop
   if (walk_source,walk_id)=(source_key,content_key) or walk_source||':'||walk_id::text=any(seen) then raise exception 'Series links cannot form a loop';end if;
   seen:=array_append(seen,walk_source||':'||walk_id::text);
   select previous_source,previous_id into walk_source,walk_id from private.content_series where (source,content_id)=(walk_source,walk_id);
  end loop;
 end if;
 select * into child from private.content_series where (previous_source,previous_id)=(source_key,content_key);
 if found and (lower(series_title)<>lower(old.series_name) or lower(collection_title)<>lower(old.collection_name)) then raise exception 'This piece has a following part. Edit that following link before changing its series or collection';end if;
 if collection_title='' and series_title='' then
  delete from private.content_series where (source,content_id)=(source_key,content_key);
  return '{}'::jsonb;
 end if;
 -- Selecting an older, unassigned predecessor enrols it automatically.
 if previous_content_key is not null and coalesce(parent.series_name,'')='' then
  insert into private.content_series(source,content_id,owner_id,collection_name,series_name) values(previous_source_key,previous_content_key,(prior->>'owner_id')::uuid,collection_title,series_title)
  on conflict(source,content_id) do update set collection_name=excluded.collection_name,series_name=excluded.series_name,updated_at=clock_timestamp();
 end if;
 insert into private.content_series(source,content_id,owner_id,collection_name,series_name,previous_source,previous_id)
 values(source_key,content_key,(target->>'owner_id')::uuid,collection_title,series_title,previous_source_key,previous_content_key)
 on conflict(source,content_id) do update set owner_id=excluded.owner_id,collection_name=excluded.collection_name,series_name=excluded.series_name,previous_source=excluded.previous_source,previous_id=excluded.previous_id,updated_at=greatest(clock_timestamp(),private.content_series.updated_at+interval '1 microsecond');
 return (select to_jsonb(r) from private.content_series r where (r.source,r.content_id)=(source_key,content_key));
end;$$;

create function private.series_public_item(source_key text,content_key uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare item private.series_content_index;projection jsonb;begin
 select * into item from private.series_content_index where (source,id)=(source_key,content_key);
 if not found then return null;end if;
 projection:=private.viewer_content_target(item.path);
 if projection is null or projection->>'id'<>content_key::text or projection->>'source'<>source_key then return null;end if;
 return projection;
end;$$;

create function private.public_content_series(content_path text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare item private.series_content_index;r private.content_series;following private.content_series;previous jsonb;next jsonb;scope text;begin
 if content_path is null or length(content_path)>180 then return null;end if;
 select * into item from private.series_content_index where path=content_path;
 if not found or private.series_public_item(item.source,item.id) is null then return null;end if;
 select * into r from private.content_series where (source,content_id)=(item.source,item.id);
 if not found then return null;end if;
 scope:=case when item.publishing_identity='fas' then 'fas' else (select public_id::text from public.profiles where id=item.owner_id) end;
 select c.* into following from private.content_series c join lateral(select i.owner_id,i.publishing_identity from private.series_content_index i where (i.source,i.id)=(c.source,c.content_id)) t on true
 where (c.previous_source,c.previous_id)=(r.source,r.content_id) and lower(c.series_name)=lower(r.series_name) and lower(c.collection_name)=lower(r.collection_name)
 and (item.publishing_identity='fas' and t.publishing_identity='fas' or item.publishing_identity='personal' and t.publishing_identity='personal' and t.owner_id=item.owner_id);
 if found then next:=private.series_public_item(following.source,following.content_id);end if;
 if r.previous_id is not null then
  select private.series_public_item(i.source,i.id) into previous from private.series_content_index i join private.content_series c on(c.source,c.content_id)=(i.source,i.id)
  where(i.source,i.id)=(r.previous_source,r.previous_id) and lower(c.series_name)=lower(r.series_name) and lower(c.collection_name)=lower(r.collection_name)
  and(item.publishing_identity='fas' and i.publishing_identity='fas' or item.publishing_identity='personal' and i.publishing_identity='personal' and i.owner_id=item.owner_id);
 end if;
 return jsonb_build_object('collection_name',r.collection_name,'series_name',r.series_name,'scope',scope,'previous',case when previous is not null then jsonb_build_object('title',previous->>'title','url',previous->>'url') end,'next',case when next is not null then jsonb_build_object('title',next->>'title','url',next->>'url') end);
end;$$;

create function private.public_content_collection(scope_key text,collection_title text,page_after text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare items jsonb;cursor text;begin
 if scope_key is null or collection_title is null or length(scope_key)>36 or length(collection_title)>100 or length(coalesce(page_after,''))>50 then return null;end if;
 with page as materialized(
 select i.source||':'||i.id::text key,private.series_public_item(i.source,i.id) item
 from private.content_series r join private.series_content_index i on(i.source,i.id)=(r.source,r.content_id)
 where lower(r.collection_name)=lower(collection_title) and r.collection_name<>''
 and(scope_key='fas' and i.publishing_identity='fas' or i.publishing_identity='personal' and exists(select 1 from public.profiles p where p.id=i.owner_id and p.public_id::text=scope_key))
 and(page_after is null or i.source||':'||i.id::text>page_after)
 and private.series_public_item(i.source,i.id) is not null order by i.source||':'||i.id::text limit 101
 ),limited as(select * from page order by key limit 100)
 select coalesce(jsonb_agg(item order by key),'[]'),case when(select count(*) from page)>100 then(select key from limited order by key desc limit 1) end into items,cursor from limited;
 return jsonb_build_object('items',items,'next_cursor',cursor);
end;$$;

create function private.my_series_data() returns jsonb language plpgsql security definer set search_path='' as $$declare caller uuid;begin
 caller:=private.require_operator_session();return coalesce((select jsonb_agg(to_jsonb(r) order by source,content_id) from private.content_series r where owner_id=caller),'[]');
end;$$;
create function private.cleanup_content_series() returns trigger language plpgsql security definer set search_path='' as $$begin
 -- Remove both membership and links to a permanently deleted piece.
 update private.content_series set previous_id=null,previous_source=null,updated_at=clock_timestamp() where previous_source=TG_ARGV[0] and previous_id=old.id;
 delete from private.content_series where source=TG_ARGV[0] and content_id=old.id;return old;
end;$$;
create trigger fas_series_story_delete after delete on public.stories for each row execute function private.cleanup_content_series('studio');
create trigger fas_series_file_delete after delete on private.file_content for each row execute function private.cleanup_content_series('file');

create function public.fas_series_editor(content_key uuid,source_key text,page_after text default null) returns jsonb language sql security invoker set search_path='' as $$select private.series_editor(content_key,source_key,page_after);$$;
create function public.fas_save_content_series(content_key uuid,source_key text,collection_title text,series_title text,previous_key text default null,expected_version timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$select private.save_content_series(content_key,source_key,collection_title,series_title,previous_key,expected_version);$$;
create function public.fas_public_content_series(content_path text) returns jsonb language sql stable security invoker set search_path='' as $$select private.public_content_series(content_path);$$;
create function public.fas_public_content_collection(scope_key text,collection_title text,page_after text default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.public_content_collection(scope_key,collection_title,page_after);$$;
create function public.fas_my_series_data() returns jsonb language sql security invoker set search_path='' as $$select private.my_series_data();$$;
revoke all on function private.series_edit_target(text,uuid),private.series_editor(uuid,text,text),private.save_content_series(uuid,text,text,text,text,timestamptz),private.series_public_item(text,uuid),private.public_content_series(text),private.public_content_collection(text,text,text),private.my_series_data(),private.cleanup_content_series(),public.fas_series_editor(uuid,text,text),public.fas_save_content_series(uuid,text,text,text,text,timestamptz),public.fas_public_content_series(text),public.fas_public_content_collection(text,text,text),public.fas_my_series_data() from public,anon,authenticated;
grant execute on function private.series_editor(uuid,text,text),private.save_content_series(uuid,text,text,text,text,timestamptz),private.my_series_data(),public.fas_series_editor(uuid,text,text),public.fas_save_content_series(uuid,text,text,text,text,timestamptz),public.fas_my_series_data() to authenticated;
grant execute on function private.public_content_series(text),private.public_content_collection(text,text,text),public.fas_public_content_series(text),public.fas_public_content_collection(text,text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
