begin;
-- Normalization is automatic and server-owned; contributor content has no review queue.
alter table public.story_assets add column verified_at timestamptz;
-- Dimensions were service-only before this migration; these are existing normalized uploads.
update public.story_assets set verified_at=created_at where pixel_width=1600 and pixel_height=900;
-- Legacy staff-cleared images remain compatible, without inventing new approvals.
create table private.studio_reserved_addresses(slug text primary key);
alter table private.studio_reserved_addresses enable row level security;
revoke all on private.studio_reserved_addresses from public,anon,authenticated;
insert into private.studio_reserved_addresses(slug) values ('a-place-left-behind'),('crypt-of-the-blood-jewel'),('date-night-jigsaw'),('michaels-choice'),('moon-hoc-meeting'),('onto-the-stage'),('sunset-at-the-lighthouse'),('tea-at-the-summit'),('the-deal'),('the-labyrinth');
create or replace function public.fas_register_verified_cover(target_story uuid,owner_key uuid,session_key uuid,image_path text,image_alt text) returns jsonb language plpgsql security definer set search_path='' as $$
declare asset public.story_assets;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_key::text,146389896));
 if not exists(select 1 from auth.sessions where id=session_key and user_id=owner_key and (not_after is null or not_after>now()))
 or not private.account_active(owner_key) or not private.current_policies_accepted(owner_key)
 or not exists(select 1 from public.user_roles where user_id=owner_key and role='member') then raise exception 'Active contributor session required';end if;
 perform 1 from public.stories where id=target_story and author_id=owner_key and status<>'archived' for update;
 if not found then raise exception 'Owned editable content required';end if;
 if image_path!~('^'||owner_key::text||'/'||target_story::text||'/[a-f0-9-]+\.jpg$') or char_length(btrim(image_alt)) not between 1 and 500 then raise exception 'Invalid verified cover';end if;
 if (select count(*) from public.story_assets where story_id=target_story)>=20 then raise exception 'Cover limit reached';end if;
 insert into public.story_assets(story_id,object_path,alt_text,pixel_width,pixel_height,verified_at) values(target_story,image_path,btrim(image_alt),1600,900,now()) returning * into asset;
 return jsonb_build_object('id',asset.id,'alt_text',asset.alt_text,'pixel_width',1600,'pixel_height',900,'verified_at',asset.verified_at,'approved_at',null);
end;$$;
create or replace function private.studio_missing_metadata(s public.stories) returns text[] language plpgsql stable security definer set search_path='' as $$
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
create or replace function public.fas_public_story(story_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'slug',s.slug,'title',s.title,'body',s.body,'summary',s.summary,'content_type',s.content_type,
  'genre',s.genre,'genres',s.genres,'tags',s.tags,'content_warning',s.content_warning,'body_document',s.body_document,
  'scene_style',s.scene_style,'drop_caps',s.drop_caps,'paragraph_style',s.paragraph_style,'language',s.language,
  'reading_minutes',greatest(1,ceil(cardinality(regexp_split_to_array(btrim(s.body),'\s+'))/225.0)),
  'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text,'width',a.pixel_width,'height',a.pixel_height) from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and (a.verified_at is not null or a.approved_at is not null)),
  'published_at',s.published_at,'updated_at',s.updated_at,'author',jsonb_build_object('public_id',p.public_id,'display_name',p.display_name,'social_links',p.social_links))
 from public.stories s join public.profiles p on p.id=s.author_id where s.slug=story_slug and s.status='published' and private.account_active(p.id)
 and exists(select 1 from public.user_roles where user_id=p.id and role='member') and char_length(story_slug)<=120;
$$;
create or replace function public.fas_public_profile(profile_key uuid,page_offset integer default 0) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('public_id',p.public_id,'display_name',p.display_name,'bio',p.bio,'welcome_line',p.welcome_line,'social_links',p.social_links,
  'stories',coalesce((select jsonb_agg(jsonb_build_object('slug',s.slug,'title',s.title,'summary',s.summary,'content_type',s.content_type,'published_at',s.published_at,
   'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text) from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and (a.verified_at is not null or a.approved_at is not null))) order by s.published_at desc,s.id)
   from (select * from public.stories where author_id=p.id and status='published' order by published_at desc,id limit 12 offset page_offset) s),'[]'::jsonb),
  'next_offset',case when (select count(*) from public.stories where author_id=p.id and status='published')>page_offset+12 then page_offset+12 else null end)
 from public.profiles p where p.public_id=profile_key and page_offset between 0 and 1000000 and private.account_active(p.id)
 and exists(select 1 from public.user_roles where user_id=p.id and role='member');
$$;
create or replace function private.guard_studio_content() returns trigger language plpgsql set search_path='' as $$
declare proposed text;
begin
 if TG_OP='UPDATE' and old.slug_locked and new.content_type is distinct from old.content_type then raise exception 'The content type is permanent after first publication';end if;
 new.paragraph_style:='indented';
 if cardinality(new.genres)>0 and (cardinality(new.genres)<>(select count(distinct g) from unnest(new.genres) g) or exists(select 1 from unnest(new.genres) g where not exists(select 1 from public.content_genres c where c.id=g))) then raise exception 'Choose up to three genres/subgenres from the catalog';end if;
 if not exists(select 1 from pg_timezone_names where name=new.publication_timezone) then raise exception 'Invalid publication timezone';end if;
 if new.body_document is not null and (TG_OP='INSERT' or new.body_document is distinct from old.body_document) then new.body:=private.manuscript_text(new.body_document);
 elsif TG_OP='UPDATE' and new.body is distinct from old.body then new.body_document:=null;end if;
 if new.slug is null or (current_user='authenticated' and (TG_OP='INSERT' or (TG_OP='UPDATE' and not old.slug_locked and new.title is distinct from old.title))) then
  proposed:=private.studio_slug(new.title);
  if exists(select 1 from public.stories where slug=proposed and id<>new.id) then proposed:=proposed||'-'||left(replace(new.id::text,'-',''),8);end if;new.slug:=proposed;
 elsif TG_OP='UPDATE' and current_user='authenticated' then new.slug:=old.slug;end if;
 if TG_OP='UPDATE' and old.slug_locked then new.slug_locked:=true;end if;
 if new.status='published' then new.slug_locked:=true;new.scheduled_at:=null;end if;
 if current_user='authenticated' and (new.status='published' or new.scheduled_at is not null) then
  if not private.content_ready(new) then raise exception 'Publication requires title, description, manuscript, one to three genres and a verified 16:9 cover with alternative text';end if;
  if new.scheduled_at is not null and (TG_OP='INSERT' or new.scheduled_at is distinct from old.scheduled_at) and new.scheduled_at<=now() then raise exception 'Choose a future publication time';end if;
 end if;
 return new;
end;$$;
alter policy assets_visibility_gate on public.story_assets using (
 exists(select 1 from public.stories s where s.id=story_id and (s.author_id=(select auth.uid()) or (select private.is_staff()) or (s.status='published' and (approved_at is not null or (verified_at is not null and s.cover_asset_id=story_assets.id)))))
);
create or replace function private.assign_unique_studio_address() returns trigger language plpgsql security definer set search_path='' as $$
declare proposed text; base text; suffix integer:=0;
begin
 if current_setting('role',true)='authenticated' and (TG_OP='INSERT' or (not old.slug_locked and new.title is distinct from old.title)) then
  base:=private.studio_slug(new.title);proposed:=base;
  -- Serialize allocation, including adversarial titles matching an existing suffix.
  perform pg_advisory_xact_lock(146389899);
  while exists(select 1 from public.stories where slug=proposed and id<>new.id) or exists(select 1 from private.studio_reserved_addresses where slug=proposed) loop
   proposed:=left(base,75)||'-'||replace(new.id::text,'-','')||case when suffix=0 then '' else '-'||suffix::text end;suffix:=suffix+1;
  end loop;new.slug:=proposed;
 end if;return new;
end;$$;
revoke all on function private.assign_unique_studio_address() from public,anon,authenticated;
create or replace function public.fas_my_studio_work(search_text text default '',type_filter text default '',state_filter text default '',before_time timestamptz default null,after_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller uuid; result jsonb; cursor jsonb;begin
 caller:=private.require_operator_session();
 if not private.is_member() then raise exception 'Contributor access required';end if;
 if search_text is null or char_length(search_text)>200 or type_filter is null or state_filter is null or state_filter not in ('','draft','scheduled','published','archived','needs-update') or (before_time is null)<>(after_id is null) then raise exception 'Invalid library filters';end if;
 with page as (select s.*,c.metadata_version as required_version,private.studio_missing_metadata(s) as missing from public.stories s join public.studio_content_types c on c.id=s.content_type where s.author_id=caller and (search_text='' or position(lower(search_text) in lower(s.title))>0) and (type_filter='' or s.content_type=type_filter) and (state_filter='' or state_filter='scheduled' and s.scheduled_at is not null or state_filter='draft' and s.status='draft' and s.scheduled_at is null or state_filter in ('published','archived') and s.status::text=state_filter or state_filter='needs-update' and (s.metadata_version>0 or s.status='published') and (s.metadata_version<c.metadata_version or cardinality(private.studio_missing_metadata(s))>0)) and (before_time is null or s.updated_at<before_time or s.updated_at=before_time and s.id>after_id) order by s.updated_at desc,s.id limit 21), limited as(select * from page order by updated_at desc,id limit 20)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'slug',slug,'status',status,'published_at',published_at,'slug_locked',slug_locked,'updated_at',updated_at,'content_type',content_type,'scheduled_at',scheduled_at,'metadata_version',metadata_version,'missing_metadata',missing,'needs_metadata_update',(metadata_version>0 or status='published') and (metadata_version<required_version or cardinality(missing)>0)) order by updated_at desc,id),'[]'),case when (select count(*) from page)>20 then (select jsonb_build_object('updated_at',updated_at,'id',id) from limited order by updated_at asc,id desc limit 1) else null end into result,cursor from limited;
 return jsonb_build_object('items',result,'next_cursor',cursor);
end;$$;
commit;
