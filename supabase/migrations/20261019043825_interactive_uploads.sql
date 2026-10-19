begin;
-- Administrators may use the site identity; existing explicit FAS publishers retain access.
create function private.can_publish_as_fas(owner_key uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.fas_publishers where user_id=owner_key) or exists(select 1 from public.user_roles where user_id=owner_key and role='admin');$$;
revoke all on function private.can_publish_as_fas(uuid) from public,anon,authenticated;

create or replace function private.guard_publishing_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.content_type='tool' then new.publishing_identity:='fas';end if;
 -- Existing attribution can still be archived by moderation after access revocation.
 if TG_OP='UPDATE' and new.publishing_identity is not distinct from old.publishing_identity and new.author_id=old.author_id and new.content_type=old.content_type then return new;end if;
 if new.publishing_identity='fas' and not private.can_publish_as_fas(new.author_id) then raise exception 'FAS publishing access required';end if;
 return new;
end;$$;
create or replace function private.public_publishing_author(owner_key uuid,identity_key text) returns jsonb language sql stable security definer set search_path='' as $$
 select case when identity_key='fas' then (select jsonb_build_object('public_id',b.public_id,'display_name',b.display_name,'social_links',b.social_links,'kind','organization') from private.publishing_brand b where singleton and private.can_publish_as_fas(p.id))
 else jsonb_build_object('public_id',p.public_id,'display_name',p.display_name,'social_links',p.social_links,'kind','person') end
 from public.profiles p where p.id=owner_key and private.account_active(p.id) and exists(select 1 from public.user_roles where user_id=p.id and role='member');
$$;
create or replace function public.fas_my_publishing_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 return jsonb_build_object('can_publish_as_fas',private.can_publish_as_fas(caller),'brand',(select jsonb_build_object('public_id',public_id,'display_name',display_name,'social_links',social_links) from private.publishing_brand where singleton));
end;$$;
create or replace function public.fas_update_file_publishing(content_key uuid,expected_version timestamptz,identity_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;item private.file_content;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if identity_key is null or identity_key not in ('personal','fas') then raise exception 'Choose a publishing name';end if;
 select * into item from private.file_content where id=content_key and owner_id=caller for update;
 if not found or item.updated_at is distinct from expected_version then raise exception 'Content changed or unavailable. Reopen it from Your work';end if;
 if item.content_type='tool' and identity_key<>'fas' then raise exception 'Tools always publish as From A Storyteller';end if;
 if identity_key='fas' and not private.can_publish_as_fas(caller) then raise exception 'FAS publishing access required';end if;
 update private.file_content set publishing_identity=identity_key,updated_at=clock_timestamp() where id=item.id;
 return (select jsonb_build_object('id',id,'updated_at',updated_at,'publishing_identity',publishing_identity) from private.file_content where id=item.id);
end;$$;
-- Files are never inserted into the authenticated page; the browser uses an opaque iframe.
alter table public.stories add column executable_package jsonb;
grant insert(executable_package),update(executable_package) on public.stories to authenticated;
create function private.valid_interactive_package(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb; names text[]:='{}'; ext text; mime text;
begin
 if p is null then return true;end if;
 if jsonb_typeof(p)<>'object' or (p->>'version') is distinct from '1' or jsonb_typeof(p->'version') is distinct from 'number' or coalesce(p->>'orientation','') not in ('landscape','portrait') or jsonb_typeof(p->'js') is distinct from 'string' or jsonb_typeof(p->'css') is distinct from 'string' or jsonb_typeof(p->'assets') is distinct from 'array' then return false;end if;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('version','orientation','js','css','assets')) or octet_length(p::text)>4194304 or octet_length(p->>'js')>262144 or octet_length(p->>'css')>65536 or jsonb_array_length(p->'assets')>24 then return false;end if;
 for a in select value from jsonb_array_elements(p->'assets') loop
  if jsonb_typeof(a)<>'object' then return false;end if;
  if exists(select 1 from jsonb_object_keys(a) k where k not in ('name','type','data')) or jsonb_typeof(a->'name') is distinct from 'string' or coalesce(a->>'name','')!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.[a-zA-Z0-9]{2,4}$' or jsonb_typeof(a->'data') is distinct from 'string' or coalesce(a->>'data','')='' or length(a->>'data')>1398104 or length(a->>'data')%4<>0 or (a->>'data')!~'^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$' or lower(a->>'name')=any(names) then return false;end if;
  ext:=lower(substring(a->>'name' from '\.([^.]+)$'));
  mime:=case ext when 'png' then 'image/png' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg' when 'webp' then 'image/webp' when 'gif' then 'image/gif' when 'mp3' then 'audio/mpeg' when 'ogg' then 'audio/ogg' when 'wav' then 'audio/wav' else null end;
  if mime is null or (a->>'type') is distinct from mime then return false;end if;names:=array_append(names,lower(a->>'name'));
 end loop;return true;
end;$$;
revoke all on function private.valid_interactive_package(jsonb) from public,anon,authenticated;
grant execute on function private.valid_interactive_package(jsonb) to authenticated,service_role;
alter table public.stories add constraint stories_package_valid check(private.valid_interactive_package(executable_package));
alter table public.stories add constraint stories_package_type check(executable_package is null or content_type in ('game','tool'));
create function private.guard_interactive_content() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.content_type='tool' or TG_OP='UPDATE' and old.content_type='tool' then
  if current_setting('role',true)='authenticated' then perform private.require_admin();end if;
  if new.content_type='tool' then new.publishing_identity:='fas';end if;
 end if;
 if new.content_type in ('game','tool') then
  new.body_document:=null;new.body:='';
  if new.executable_package is not null and not private.valid_interactive_package(new.executable_package) then raise exception 'Invalid or oversized interactive package';end if;
 end if;return new;
end;$$;
revoke all on function private.guard_interactive_content() from public,anon,authenticated;
create trigger fas_interactive_content before insert or update on public.stories for each row execute function private.guard_interactive_content();
-- Reserve repository interactive slugs, preserving the existing file pages.
insert into private.studio_reserved_addresses(slug) select slug from private.file_content where content_type in ('game','tool') on conflict do nothing;
insert into public.content_genres(id,label,parent_label) values
 ('arcade','Arcade','Games'),('action','Action','Games'),('puzzle','Puzzle','Games'),('strategy','Strategy','Games'),('simulation','Simulation','Games'),('creative-tool','Creative tool','Tools'),('writing-tool','Writing tool','Tools'),('productivity','Productivity','Tools') on conflict do nothing;
update public.studio_content_types set enabled=true,required_fields=array['title','summary','genres','cover','warnings'],genre_ids=array(select id from public.content_genres where parent_label in ('Games','Tools','Blog & nonfiction')),
 metadata_fields='[{"key":"instructions","label":"Controls and instructions","type":"text","required":true,"max_length":2000}]'::jsonb where id in ('game','tool');
-- Separate the existing editorial readiness checks from executable readiness.

create or replace function private.editorial_missing_metadata(s public.stories) returns text[] language plpgsql stable security definer set search_path='' as $$
declare config public.studio_content_types; missing text[]:='{}'; field text; definition jsonb; value jsonb;
begin
 select * into config from public.studio_content_types where id=s.content_type;
 foreach field in array config.required_fields loop
  if (case field when 'title' then char_length(btrim(s.title))=0 when 'summary' then char_length(btrim(s.summary))<10 when 'body' then char_length(btrim(replace(s.body,'***','')))=0 when 'genres' then cardinality(s.genres)=0 when 'warnings' then not s.warning_reviewed when 'cover' then not exists(select 1 from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and (a.verified_at is not null or a.approved_at is not null) and char_length(btrim(a.alt_text))>0 and a.pixel_width::bigint*9=a.pixel_height::bigint*16) else true end) then missing:=array_append(missing,field);end if;
 end loop;
 for definition in select f.value from jsonb_array_elements(config.metadata_fields) f loop
  value:=s.metadata->(definition->>'key');
  if coalesce((definition->>'required')::boolean,false) and (value is null or value='null' or value='""' or value='[]') then missing:=array_append(missing,definition->>'key');end if;
 end loop;
 return missing;
end;$$;
revoke all on function private.editorial_missing_metadata(public.stories) from public,anon,authenticated;
create or replace function private.studio_missing_metadata(s public.stories) returns text[] language plpgsql stable security definer set search_path='' as $$
declare missing text[];begin
 missing:=private.editorial_missing_metadata(s);
 if s.content_type in ('game','tool') and (s.executable_package is null or not private.valid_interactive_package(s.executable_package) or btrim(s.executable_package->>'js')='') then missing:=array_append(missing,'executable_package');end if;
 return missing;
end;$$;
create or replace function private.content_ready(s public.stories) returns boolean language sql stable security definer set search_path='' as $$select cardinality(private.studio_missing_metadata(s))=0 and exists(select 1 from public.studio_content_types c where c.id=s.content_type and c.enabled);$$;
-- Public metadata excludes executable code; player code is fetched only on demand.

create or replace function public.fas_public_story(story_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'slug',s.slug,'title',s.title,'body',s.body,'summary',s.summary,'content_type',s.content_type,
  'metadata',s.metadata,'genre',s.genre,'genres',s.genres,'tags',s.tags,'content_warning',s.content_warning,'body_document',s.body_document,
  'scene_style',s.scene_style,'drop_caps',s.drop_caps,'paragraph_style',s.paragraph_style,'language',s.language,
  'reading_minutes',greatest(1,ceil(cardinality(regexp_split_to_array(btrim(s.body),'\s+'))/225.0)),
  'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text,'width',a.pixel_width,'height',a.pixel_height) from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and (a.verified_at is not null or a.approved_at is not null)),
  'published_at',s.published_at,'updated_at',s.updated_at,'author',private.public_publishing_author(s.author_id,s.publishing_identity))
 from public.stories s join public.profiles p on p.id=s.author_id where s.slug=story_slug and s.status='published' and private.account_active(p.id)
 and exists(select 1 from public.user_roles where user_id=p.id and role='member') and char_length(story_slug)<=120 and private.public_publishing_author(s.author_id,s.publishing_identity) is not null;
$$;
create function private.public_interactive_package(story_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select s.executable_package from public.stories s where s.slug=story_slug and s.content_type in ('game','tool') and s.status='published' and private.account_active(s.author_id) and private.public_publishing_author(s.author_id,s.publishing_identity) is not null;
$$;
revoke all on function private.public_interactive_package(text) from public,anon,authenticated;
grant execute on function private.public_interactive_package(text) to anon,authenticated;
create function public.fas_public_interactive_package(story_slug text) returns jsonb language sql stable security invoker set search_path='' as $$select private.public_interactive_package(story_slug);$$;
revoke all on function public.fas_public_interactive_package(text) from public,anon,authenticated;
grant execute on function public.fas_public_interactive_package(text) to anon,authenticated;
create or replace function public.fas_account_snapshot(target_user uuid, target_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  perform private.require_account_session(target_user,target_session);
  if not private.account_active(target_user) then raise exception 'Account is closing'; end if;
  if (select count(*) from (select 1 from public.stories where author_id=target_user limit 301) s)>300
    or (select coalesce(sum(octet_length(body)+coalesce(octet_length(executable_package::text),0)),0) from public.stories where author_id=target_user)>16777216
    or (select count(*) from (select 1 from public.story_assets a join public.stories s on s.id=a.story_id where s.author_id=target_user limit 501) a)>500
    or (select count(*) from (select 1 from storage.objects where bucket_id='fas-story-images' and split_part(name,'/',1)=target_user::text limit 501) o)>500 then
    raise exception 'Account content requires background export';
  end if;
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where id = target_user),
    'role', coalesce((select role::text from public.user_roles where user_id = target_user order by case role when 'member' then 0 when 'admin' then 1 else 2 end limit 1),'viewer'),
    'stories', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.stories s where author_id = target_user),'[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'approved_by' order by a.id) from public.story_assets a join public.stories s on s.id = a.story_id where s.author_id = target_user),'[]'::jsonb),
    'objects', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'path',o.name,'size',o.metadata->>'size','type',o.metadata->>'mimetype','updated_at',o.updated_at) order by o.name) from storage.objects o where bucket_id = 'fas-story-images' and split_part(name,'/',1) = target_user::text),'[]'::jsonb)
  ) into payload;
  if payload->'profile' = 'null'::jsonb then raise exception 'Account unavailable'; end if;
  return jsonb_build_object('data',payload,'fingerprint',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
end; $$;
notify pgrst,'reload schema';
commit;
