begin;
create table public.content_genres(id text primary key,label text not null,parent_label text not null);
alter table public.content_genres enable row level security;
grant select on public.content_genres to anon,authenticated;
grant all on public.content_genres to service_role;
create policy genre_catalog_read on public.content_genres for select to anon,authenticated using(true);
insert into public.content_genres(id,label,parent_label) values
('fantasy','Fantasy','Fantasy'),
('high-fantasy','High fantasy','Fantasy'),
('low-fantasy','Low fantasy','Fantasy'),
('dark-fantasy','Dark fantasy','Fantasy'),
('urban-fantasy','Urban fantasy','Fantasy'),
('fairy-tale','Fairy tale','Fantasy'),
('magical-realism','Magical realism','Fantasy'),
('science-fiction','Science fiction','Science fiction'),
('cyberpunk','Cyberpunk','Science fiction'),
('dystopian','Dystopian','Science fiction'),
('artificial-intelligence','Artificial intelligence','Science fiction'),
('time-travel','Time travel','Science fiction'),
('space-opera','Space opera','Science fiction'),
('mystery','Mystery','Mystery & suspense'),
('crime','Crime','Mystery & suspense'),
('thriller','Thriller','Mystery & suspense'),
('psychological-thriller','Psychological thriller','Mystery & suspense'),
('cosy-mystery','Cosy mystery','Mystery & suspense'),
('horror','Horror','Horror & supernatural'),
('gothic','Gothic','Horror & supernatural'),
('supernatural','Supernatural','Horror & supernatural'),
('cosmic-horror','Cosmic horror','Horror & supernatural'),
('literary-fiction','Literary fiction','People & history'),
('contemporary-fiction','Contemporary fiction','People & history'),
('historical-fiction','Historical fiction','People & history'),
('romance','Romance','People & history'),
('adventure','Adventure','People & history'),
('humour','Humour','People & history'),
('young-adult','Young adult','People & history'),
('children-s-fiction','Children’s fiction','People & history'),
('writing-craft','Writing craft','Blog & nonfiction'),
('behind-the-story','Behind the story','Blog & nonfiction'),
('personal-essay','Personal essay','Blog & nonfiction'),
('creative-process','Creative process','Blog & nonfiction'),
('books-reading','Books & reading','Blog & nonfiction'),
('worldbuilding','Worldbuilding','Blog & nonfiction'),
('site-news','Site news','Blog & nonfiction');

alter table public.profiles add column social_links jsonb not null default '[]'::jsonb;
alter table public.stories
 add column content_type text not null default 'story' check(content_type in ('story','blog')),
 add column genres text[] not null default '{}' check(cardinality(genres)<=3 and array_position(genres,null) is null),
 add column body_document jsonb,
 add column scene_style text not null default 'space' check(scene_style in ('space','dots','diamond','rule')),
 add column drop_caps boolean not null default false,
 add column paragraph_style text not null default 'indented' check(paragraph_style in ('indented','spaced')),
 add column language text not null default 'en' check(language in ('en','mi','fr','de','es','it','pt','ja','ko','zh','other')),
 add column scheduled_at timestamptz,
 add column publication_timezone text not null default 'Pacific/Auckland',
 add column slug_locked boolean not null default false;
alter table public.story_assets add column pixel_width integer check(pixel_width between 1 and 16384),add column pixel_height integer check(pixel_height between 1 and 16384);
grant update(social_links) on public.profiles to authenticated;
grant insert(content_type,genres,body_document,scene_style,drop_caps,paragraph_style,language,scheduled_at,publication_timezone),
 update(content_type,genres,body_document,scene_style,drop_caps,paragraph_style,language,scheduled_at,publication_timezone) on public.stories to authenticated;
create index stories_due_publication on public.stories(scheduled_at) where status='draft' and scheduled_at is not null;

create function private.valid_social_links(links jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; names text[]:='{}'; platform text; url text; host text;
begin
 if jsonb_typeof(links)<>'array' or jsonb_array_length(links)>10 then return false;end if;
 for item in select value from jsonb_array_elements(links) loop
  platform:=item->>'platform';url:=item->>'url';
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'url') is distinct from 'string' or platform is null or not platform=any(array['website','instagram','facebook','tiktok','youtube','bluesky','threads','x','linkedin','github','twitch','mastodon'])
   or platform=any(names) or char_length(url)>500 or url!~'^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/?#]|$)' or url~'[[:space:]@]' then return false;end if;
  host:=lower(substring(url from '^https://([^/?#]+)'));host:=regexp_replace(host,'^www\.','');
  if platform not in ('website','mastodon') and not (
   (platform='instagram' and host='instagram.com') or (platform='facebook' and host='facebook.com') or (platform='tiktok' and host='tiktok.com') or
   (platform='youtube' and host in ('youtube.com','youtu.be')) or (platform='bluesky' and host='bsky.app') or (platform='threads' and host in ('threads.net','threads.com')) or
   (platform='x' and host in ('x.com','twitter.com')) or (platform='linkedin' and host='linkedin.com') or (platform='github' and host='github.com') or (platform='twitch' and host='twitch.tv')) then return false;end if;
  names:=array_append(names,platform);
 end loop;return true;
end;$$;
revoke all on function private.valid_social_links(jsonb) from public,anon,authenticated;
grant execute on function private.valid_social_links(jsonb) to authenticated,service_role;
alter table public.profiles add constraint profiles_social_links_valid check(private.valid_social_links(social_links));

create function private.manuscript_text(document jsonb) returns text language plpgsql immutable set search_path='' as $$
declare block jsonb; run jsonb; pieces text[]:='{}'; paragraph text; key text;
begin
 if document is null then return null;end if;
 if jsonb_typeof(document)<>'object' or document->>'version'<>'1' or jsonb_typeof(document->'blocks')<>'array' or jsonb_array_length(document->'blocks')>5000 then raise exception 'Invalid manuscript document';end if;
 for block in select value from jsonb_array_elements(document->'blocks') loop
  if jsonb_typeof(block)<>'object' or not coalesce(block->>'type','')=any(array['paragraph','heading','quote','scene']) then raise exception 'Unsupported manuscript block';end if;
  for key in select jsonb_object_keys(block) loop if key not in ('type','text','runs') then raise exception 'Unsupported manuscript field';end if;end loop;
  if block->>'type'='scene' then paragraph:='***';
  elsif block ? 'runs' then
   if jsonb_typeof(block->'runs')<>'array' or jsonb_array_length(block->'runs')>10000 then raise exception 'Invalid text runs';end if;
   paragraph:='';for run in select value from jsonb_array_elements(block->'runs') loop
    if jsonb_typeof(run)<>'object' or jsonb_typeof(run->'text') is distinct from 'string' then raise exception 'Invalid text run';end if;
    for key in select jsonb_object_keys(run) loop if key not in ('text','bold','italic') then raise exception 'Unsupported formatting';end if;end loop;
    if (run ? 'bold' and jsonb_typeof(run->'bold')<>'boolean') or (run ? 'italic' and jsonb_typeof(run->'italic')<>'boolean') then raise exception 'Invalid formatting';end if;
    paragraph:=paragraph||(run->>'text');
   end loop;
  else if jsonb_typeof(block->'text') is distinct from 'string' then raise exception 'Paragraph text required';end if;paragraph:=block->>'text';end if;
  pieces:=array_append(pieces,paragraph);
 end loop;
 paragraph:=array_to_string(pieces,E'\n\n');if char_length(paragraph)>200000 then raise exception 'Manuscript too long';end if;return paragraph;
end;$$;
revoke all on function private.manuscript_text(jsonb) from public,anon,authenticated;
grant execute on function private.manuscript_text(jsonb) to authenticated,service_role;

create function private.studio_slug(title text) returns text language sql immutable set search_path='' as $$
 select coalesce(nullif(trim(both '-' from left(regexp_replace(lower(translate(title,'áàäâãåéèëêíìïîóòöôõúùüûñç','aaaaaaeeeeiiiiooooouuuunc')),'[^a-z0-9]+','-','g'),100)),''),'untitled');
$$;
revoke all on function private.studio_slug(text) from public,anon,authenticated;
grant execute on function private.studio_slug(text) to authenticated,service_role;

create function private.content_ready(s public.stories) returns boolean language sql stable security definer set search_path='' as $$
 select char_length(btrim(s.title))>0 and char_length(btrim(s.summary))>=10 and char_length(btrim(s.body))>0
 and cardinality(s.genres) between 1 and 3 and not exists(select 1 from unnest(s.genres) g where not exists(select 1 from public.content_genres c where c.id=g))
 and exists(select 1 from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and a.approved_at is not null
  and char_length(btrim(a.alt_text))>0 and a.pixel_width::bigint*9=a.pixel_height::bigint*16);
$$;
revoke all on function private.content_ready(public.stories) from public,anon,authenticated;
grant execute on function private.content_ready(public.stories) to authenticated,service_role;

-- Trigger name sorts after the existing ownership/timestamp guard.
create function private.guard_studio_content() returns trigger language plpgsql set search_path='' as $$
declare proposed text;
begin
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
  if not private.content_ready(new) then raise exception 'Publication requires title, description, manuscript, one to three genres and an approved 16:9 cover with alternative text';end if;
  if new.scheduled_at is not null and (TG_OP='INSERT' or new.scheduled_at is distinct from old.scheduled_at) and new.scheduled_at<=now() then raise exception 'Choose a future publication time';end if;
 end if;
 return new;
end;$$;
revoke all on function private.guard_studio_content() from public,anon,authenticated;
create trigger fas_studio_content before insert or update on public.stories for each row execute function private.guard_studio_content();

create function private.cancel_removed_contributor_schedule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' and old.role='member' or TG_OP='UPDATE' and old.role='member' and (new.role<>'member' or new.user_id<>old.user_id) then
  perform pg_advisory_xact_lock(hashtextextended(old.user_id::text,146389896));
  update public.stories set scheduled_at=null where author_id=old.user_id and scheduled_at is not null;
 end if;
 if TG_OP='DELETE' then return old;end if;return new;
end;$$;
revoke all on function private.cancel_removed_contributor_schedule() from public,anon,authenticated;
create trigger fas_cancel_contributor_schedules before delete or update on public.user_roles for each row execute function private.cancel_removed_contributor_schedule();

create function private.publish_due_content() returns integer language plpgsql security invoker set search_path='' as $$
declare row public.stories; count_published integer:=0;
begin
 for row in select * from public.stories where status='draft' and scheduled_at<=now() order by scheduled_at limit 100 for update skip locked loop
  perform pg_advisory_xact_lock(hashtextextended(row.author_id::text,146389896));
  if exists(select 1 from public.user_roles where user_id=row.author_id and role='member') and private.account_active(row.author_id) and private.current_policies_accepted(row.author_id) and private.content_ready(row) then
   update public.stories set status='published',scheduled_at=null where id=row.id and status='draft';count_published:=count_published+1;
  end if;
 end loop;return count_published;
end;$$;
revoke all on function private.publish_due_content() from public,anon,authenticated;
grant execute on function private.publish_due_content() to service_role;

create or replace function public.fas_public_story(story_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('slug',s.slug,'title',s.title,'body',s.body,'summary',s.summary,'content_type',s.content_type,
  'genre',s.genre,'genres',s.genres,'tags',s.tags,'content_warning',s.content_warning,'body_document',s.body_document,
  'scene_style',s.scene_style,'drop_caps',s.drop_caps,'paragraph_style',s.paragraph_style,'language',s.language,
  'reading_minutes',greatest(1,ceil(cardinality(regexp_split_to_array(btrim(s.body),'\s+'))/225.0)),
  'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text,'width',a.pixel_width,'height',a.pixel_height) from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and a.approved_at is not null),
  'published_at',s.published_at,'updated_at',s.updated_at,'author',jsonb_build_object('public_id',p.public_id,'display_name',p.display_name,'social_links',p.social_links))
 from public.stories s join public.profiles p on p.id=s.author_id where s.slug=story_slug and s.status='published' and private.account_active(p.id)
 and exists(select 1 from public.user_roles where user_id=p.id and role='member') and char_length(story_slug)<=120;
$$;
revoke all on function public.fas_public_story(text) from public,anon,authenticated;
grant execute on function public.fas_public_story(text) to anon,authenticated;

create or replace function public.fas_public_profile(profile_key uuid,page_offset integer default 0) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('public_id',p.public_id,'display_name',p.display_name,'bio',p.bio,'welcome_line',p.welcome_line,'social_links',p.social_links,
  'stories',coalesce((select jsonb_agg(jsonb_build_object('slug',s.slug,'title',s.title,'summary',s.summary,'content_type',s.content_type,'published_at',s.published_at,
   'cover',(select jsonb_build_object('asset_id',a.id,'alt',a.alt_text) from public.story_assets a where a.id=s.cover_asset_id and a.story_id=s.id and a.approved_at is not null)) order by s.published_at desc,s.id)
   from (select * from public.stories where author_id=p.id and status='published' order by published_at desc,id limit 12 offset page_offset) s),'[]'::jsonb),
  'next_offset',case when (select count(*) from public.stories where author_id=p.id and status='published')>page_offset+12 then page_offset+12 else null end)
 from public.profiles p where p.public_id=profile_key and page_offset between 0 and 1000000 and private.account_active(p.id)
 and exists(select 1 from public.user_roles where user_id=p.id and role='member');
$$;
revoke all on function public.fas_public_profile(uuid,integer) from public,anon,authenticated;
grant execute on function public.fas_public_profile(uuid,integer) to anon,authenticated;
create table private.studio_cover_limits(user_id uuid primary key references auth.users(id) on delete cascade,period timestamptz not null,attempts integer not null);
alter table private.studio_cover_limits enable row level security;
revoke all on private.studio_cover_limits from public,anon,authenticated;
create function public.fas_begin_cover_upload(target_story uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_key uuid; attempts integer;
begin
 perform private.require_operator_session();
 perform private.require_contributor_write(auth.uid());
 select author_id into owner_key from public.stories where id=target_story and author_id=auth.uid() and status<>'archived' for update;
 if owner_key is null then raise exception 'Owned editable content required';end if;
 if (select count(*) from public.story_assets where story_id=target_story)>=20 then raise exception 'Cover limit reached for this content';end if;
 insert into private.studio_cover_limits(user_id,period,attempts) values(owner_key,date_trunc('hour',now()),1)
 on conflict(user_id) do update set period=excluded.period,attempts=case when studio_cover_limits.period=excluded.period then studio_cover_limits.attempts+1 else 1 end
 returning studio_cover_limits.attempts into attempts;
 if attempts>20 then raise exception 'Cover upload limit reached. Try again later';end if;
 return jsonb_build_object('author_id',owner_key,'story_id',target_story);
end;$$;
revoke all on function public.fas_begin_cover_upload(uuid) from public,anon,authenticated;
grant execute on function public.fas_begin_cover_upload(uuid) to authenticated;

create function public.fas_register_verified_cover(target_story uuid,owner_key uuid,session_key uuid,image_path text,image_alt text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into public.story_assets(story_id,object_path,alt_text,pixel_width,pixel_height) values(target_story,image_path,btrim(image_alt),1600,900) returning * into asset;
 return jsonb_build_object('id',asset.id,'alt_text',asset.alt_text,'pixel_width',1600,'pixel_height',900,'approved_at',null);
end;$$;
revoke all on function public.fas_register_verified_cover(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.fas_register_verified_cover(uuid,uuid,uuid,text,text) to service_role;
commit;
