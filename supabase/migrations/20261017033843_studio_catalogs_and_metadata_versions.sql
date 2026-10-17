begin;
-- Catalog versions describe manual requirements, independently of the editor release.
create table public.studio_content_types(id text primary key,label text not null,enabled boolean not null default false,metadata_version integer not null default 1 check(metadata_version>0),required_fields text[] not null,metadata_fields jsonb not null default '[]' check(jsonb_typeof(metadata_fields)='array'),genre_ids text[] not null default '{}');
create table public.content_warnings(id text primary key,label text not null unique,active boolean not null default true);
alter table public.studio_content_types enable row level security;
alter table public.content_warnings enable row level security;
create policy studio_types_read on public.studio_content_types for select to anon,authenticated using(true);
create policy studio_warnings_read on public.content_warnings for select to anon,authenticated using(true);
grant select on public.studio_content_types,public.content_warnings to anon,authenticated;
grant all on public.studio_content_types,public.content_warnings to service_role;
insert into public.studio_content_types(id,label,enabled,required_fields,genre_ids) values
 ('story','Story',true,array['title','summary','body','genres','cover','warnings'],array(select id from public.content_genres where parent_label<>'Blog & nonfiction')),
 ('blog','Blog post',true,array['title','summary','body','genres','cover','warnings'],array(select id from public.content_genres)),
 ('game','Game',false,array['title','summary','cover','warnings'],'{}'),('tool','Tool',false,array['title','summary','cover','warnings'],'{}'),('video','Video',false,array['title','summary','cover','warnings'],'{}');
insert into public.content_warnings(id,label) values ('violence','Violence'),('graphic-violence','Graphic violence / gore'),('death-grief','Death or grief'),('abuse','Abuse'),('sexual-content','Sexual content'),('strong-language','Strong language'),('self-harm','Self-harm or suicide themes'),('discrimination','Discrimination'),('substance-use','Substance use'),('flashing-lights','Flashing lights');
alter table public.stories drop constraint stories_content_type_check;
alter table public.stories add foreign key(content_type) references public.studio_content_types(id),add column metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=16000),add column metadata_version integer not null default 0,add column warning_ids text[] not null default '{}' check(cardinality(warning_ids)<=10 and array_position(warning_ids,null) is null),add column warning_reviewed boolean not null default false;
grant insert(metadata,warning_ids,warning_reviewed),update(metadata,warning_ids,warning_reviewed) on public.stories to authenticated;
create function private.studio_missing_metadata(s public.stories) returns text[] language plpgsql stable security definer set search_path='' as $$
declare config public.studio_content_types; missing text[]:='{}'; field text; definition jsonb; value jsonb;
begin
 select * into config from public.studio_content_types where id=s.content_type;
 foreach field in array config.required_fields loop
  if (case field when 'title' then char_length(btrim(s.title))=0 when 'summary' then char_length(btrim(s.summary))<10 when 'body' then char_length(btrim(replace(s.body,'***','')))=0 when 'genres' then cardinality(s.genres)=0 when 'warnings' then not s.warning_reviewed when 'cover' then not exists(select 1 from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and a.approved_at is not null and char_length(btrim(a.alt_text))>0 and a.pixel_width::bigint*9=a.pixel_height::bigint*16) else true end) then missing:=array_append(missing,field);end if;
 end loop;
 for definition in select f.value from jsonb_array_elements(config.metadata_fields) f loop
  value:=s.metadata->(definition->>'key');
  if coalesce((definition->>'required')::boolean,false) and (value is null or value='null' or value='""' or value='[]') then missing:=array_append(missing,definition->>'key');end if;
 end loop;
 return missing;
end;$$;
revoke all on function private.studio_missing_metadata(public.stories) from public,anon,authenticated;
grant execute on function private.studio_missing_metadata(public.stories) to authenticated,service_role;
create or replace function private.content_ready(s public.stories) returns boolean language sql stable security definer set search_path='' as $$select cardinality(private.studio_missing_metadata(s))=0 and exists(select 1 from public.studio_content_types c where c.id=s.content_type and c.enabled);$$;
create function private.guard_studio_metadata() returns trigger language plpgsql security definer set search_path='' as $$
declare config public.studio_content_types; definition jsonb; value jsonb; key text;
begin
 select * into config from public.studio_content_types where id=new.content_type;
 if not found or (not config.enabled and (TG_OP='INSERT' or new.content_type is distinct from old.content_type)) then raise exception 'This content type is not available in Studio yet';end if;
 if cardinality(new.warning_ids)<>(select count(distinct x) from unnest(new.warning_ids)x) or exists(select 1 from unnest(new.warning_ids)x where not exists(select 1 from public.content_warnings where id=x)) then raise exception 'Choose content warnings from the list';end if;
 if new.warning_reviewed then select coalesce(string_agg(label,', ' order by label),'') into new.content_warning from public.content_warnings where id=any(new.warning_ids);end if;
 if exists(select 1 from unnest(new.genres)x where not x=any(config.genre_ids)) then raise exception 'Choose genres for this content type';end if;
 for key in select jsonb_object_keys(new.metadata) loop
  if not exists(select 1 from jsonb_array_elements(config.metadata_fields) f where f->>'key'=key) then raise exception 'Unknown metadata field';end if;
 end loop;
 for definition in select f.value from jsonb_array_elements(config.metadata_fields) f loop
  value:=new.metadata->(definition->>'key');
  if value is null or value='null' or value='""' then continue;end if;
  if not (case definition->>'type'
   when 'text' then jsonb_typeof(value)='string' and char_length(value#>>'{}')<=coalesce((definition->>'max_length')::int,1000)
   when 'integer' then jsonb_typeof(value)='number' and (value#>>'{}')~'^-?[0-9]+$' and (value#>>'{}')::numeric between coalesce((definition->>'min')::numeric,-2147483648) and coalesce((definition->>'max')::numeric,2147483647)
   when 'select' then jsonb_typeof(value)='string' and definition->'options' ? (value#>>'{}')
   else false end) then raise exception 'Invalid metadata field: %',definition->>'label';end if;
 end loop;
 -- Only the server acknowledges the latest version after all requirements are met.
 if cardinality(private.studio_missing_metadata(new))=0 then new.metadata_version:=config.metadata_version;
 elsif TG_OP='INSERT' then new.metadata_version:=0;else new.metadata_version:=old.metadata_version;end if;
 return new;
end;$$;
revoke all on function private.guard_studio_metadata() from public,anon,authenticated;
create trigger fas_studio_metadata before insert or update on public.stories for each row execute function private.guard_studio_metadata();
create index studio_library_order on public.stories(author_id,updated_at desc,id);
create function public.fas_my_studio_work(search_text text default '',type_filter text default '',state_filter text default '',before_time timestamptz default null,after_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid; result jsonb; cursor jsonb;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if search_text is null or char_length(search_text)>200 or type_filter is null or state_filter is null or state_filter not in ('','draft','scheduled','published','archived','needs-update') or (before_time is null)<>(after_id is null) then raise exception 'Invalid library filters';end if;
 with page as (select s.*,c.metadata_version as required_version,private.studio_missing_metadata(s) as missing from public.stories s join public.studio_content_types c on c.id=s.content_type where s.author_id=caller and (search_text='' or position(lower(search_text) in lower(s.title))>0) and (type_filter='' or s.content_type=type_filter) and (state_filter='' or state_filter='scheduled' and s.scheduled_at is not null or state_filter='draft' and s.status='draft' and s.scheduled_at is null or state_filter in ('published','archived') and s.status::text=state_filter or state_filter='needs-update' and (s.metadata_version>0 or s.status='published') and (s.metadata_version<c.metadata_version or cardinality(private.studio_missing_metadata(s))>0)) and (before_time is null or s.updated_at<before_time or s.updated_at=before_time and s.id>after_id) order by s.updated_at desc,s.id limit 21), limited as(select * from page order by updated_at desc,id limit 20)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'slug',slug,'status',status,'updated_at',updated_at,'content_type',content_type,'scheduled_at',scheduled_at,'metadata_version',metadata_version,'missing_metadata',missing,'needs_metadata_update',(metadata_version>0 or status='published') and (metadata_version<required_version or cardinality(missing)>0)) order by updated_at desc,id),'[]'),case when (select count(*) from page)>20 then (select jsonb_build_object('updated_at',updated_at,'id',id) from limited order by updated_at asc,id desc limit 1) else null end into result,cursor from limited;
 return jsonb_build_object('items',result,'next_cursor',cursor);
end;$$;
revoke all on function public.fas_my_studio_work(text,text,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.fas_my_studio_work(text,text,text,timestamptz,uuid) to authenticated;
create table private.content_warning_requests(id uuid primary key default gen_random_uuid(),requester_id uuid references public.profiles(id) on delete set null,label text not null check(char_length(btrim(label)) between 1 and 100),reason text not null check(char_length(btrim(reason)) between 1 and 500),status text not null default 'pending' check(status in ('pending','approved','declined')),admin_note text,created_at timestamptz not null default now(),reviewed_at timestamptz);
alter table private.content_warning_requests enable row level security;
revoke all on private.content_warning_requests from public,anon,authenticated;
create function public.fas_request_content_warning(requested_label text,request_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid; result uuid;begin
 caller:=private.require_operator_session();if not private.is_member() then raise exception 'Contributor access required';end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,146389897));
 if (select count(*) from private.content_warning_requests where requester_id=caller and status='pending')>=5 then raise exception 'You already have five pending requests';end if;
 if exists(select 1 from private.content_warning_requests where requester_id=caller and status='pending' and lower(label)=lower(btrim(requested_label))) then raise exception 'This request is already pending';end if;
 insert into private.content_warning_requests(requester_id,label,reason) values(caller,btrim(requested_label),btrim(request_reason)) returning id into result;return result;
end;$$;
create function public.fas_my_warning_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid;begin caller:=private.require_operator_session();return coalesce((select jsonb_agg(jsonb_build_object('label',label,'status',status,'admin_note',admin_note) order by created_at desc) from (select * from private.content_warning_requests where requester_id=caller order by created_at desc limit 50)r),'[]');end;$$;
create function public.fas_admin_warning_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$begin perform private.require_admin();return coalesce((select jsonb_agg(to_jsonb(r) order by created_at) from (select id,label,reason,status,created_at from private.content_warning_requests where status='pending' order by created_at limit 50)r),'[]');end;$$;
create function public.fas_admin_review_warning(request_id uuid,approve boolean,note text) returns void language plpgsql security definer set search_path='' as $$
declare caller uuid; request private.content_warning_requests;begin
 caller:=private.require_admin();if approve is null or note is null or char_length(btrim(note)) not between 1 and 500 then raise exception 'Reason required';end if;
 select * into request from private.content_warning_requests where id=request_id and status='pending' for update;if not found then raise exception 'Request is no longer pending';end if;
 if approve then insert into public.content_warnings(id,label) values(private.studio_slug(request.label),request.label) on conflict do nothing;end if;
 update private.content_warning_requests set status=case when approve then 'approved' else 'declined' end,admin_note=btrim(note),reviewed_at=now() where id=request_id;
 insert into private.admin_audit(actor_id,action,subject_id,reason) values(caller,'content_warning_reviewed',request_id,btrim(note));
end;$$;
revoke all on function public.fas_request_content_warning(text,text),public.fas_my_warning_requests(),public.fas_admin_warning_requests(),public.fas_admin_review_warning(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.fas_request_content_warning(text,text),public.fas_my_warning_requests(),public.fas_admin_warning_requests(),public.fas_admin_review_warning(uuid,boolean,text) to authenticated;
commit;
